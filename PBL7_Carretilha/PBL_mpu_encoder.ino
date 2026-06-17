#include <Wire.h>
#include <esp_now.h>
#include <WiFi.h>

// --- Definições de Hardware ---
#define IMU_ADDR 0x68

// Pinos seguros (GPIO 4 e 5) para evitar conflito com a USB nativa
#define PIN_A 4
#define PIN_B 5

// --- Pinos I2C Validados e Funcionando ---
#define PIN_SDA 8
#define PIN_SCL 9

// --- Parâmetros do Encoder AJUSTADOS para o seu de 600 PPR ---
#define PPR          600    // Seu encoder incremental é de 600 Pulsos
#define MODO_X4      4      // Multiplica por 4 pelas leituras de subida e descida de A e B
#define DIAMETRO_M   0.068   
#define INTERVALO_MS 100    // Intervalo para cálculo de velocidade

// Registradores MPU
#define REG_ACCEL_XOUT_H 0x3B
#define REG_PWR_MGMT_1   0x6B

// --- Variáveis Globais ---
volatile long contagem = 0;
long contagem_anterior = 0;
unsigned long ultimo_tempo_encoder = 0;
float velocidade_ms = 0;

// Estrutura para dados do Atleta (Circuito Remoto) - Apenas Acelerômetro
typedef struct struct_message {
    float ax, ay, az;
} struct_message;

struct_message dadosAtleta;
bool novoDadoAtleta = false;

// --- Variável de Controle de Tempo Sincronizada (10ms) ---
unsigned long ultima_amostra = 0;

// --- Interrupções do Encoder (ISRs) - Sentido Invertido de Rotação ---
void IRAM_ATTR isr_A() {
  digitalRead(PIN_A) == digitalRead(PIN_B) ? contagem-- : contagem++;
}

void IRAM_ATTR isr_B() {
  digitalRead(PIN_A) != digitalRead(PIN_B) ? contagem-- : contagem++;
}

// --- Callback de Recepção do ESP-NOW ---
void OnDataRecv(const esp_now_recv_info_t *recv_info, const uint8_t *incomingData, int len) {
    memcpy(&dadosAtleta, incomingData, sizeof(dadosAtleta));
    novoDadoAtleta = true;
}

// --- Funções MPU com Proteção Contra Travamento ---
void wakeIMU(uint8_t addr) {
    Wire.beginTransmission(addr);
    Wire.write(REG_PWR_MGMT_1);
    Wire.write(0x00);
    Wire.endTransmission();
    
    Wire.beginTransmission(addr);
    Wire.write(0x1C);
    Wire.write(0x10); // ±8g
    Wire.endTransmission();
}

// Solicitando apenas 6 bytes (X, Y, Z do acelerômetro) para otimizar o barramento
void readIMU(uint8_t addr, float* ax, float* ay, float* az) {
    int16_t raw[3] = {0, 0, 0};
    
    Wire.beginTransmission(addr);
    Wire.write(REG_ACCEL_XOUT_H);
    
    if (Wire.endTransmission(false) == 0) {
        Wire.requestFrom(addr, (uint8_t)6);
        for (int i = 0; i < 3; i++) {
            if (Wire.available() >= 2) {
                raw[i] = (Wire.read() << 8) | Wire.read();
            }
        }
    }
    
    *ax = raw[0] / 4096.0f; 
    *ay = raw[1] / 4096.0f; 
    *az = raw[2] / 4096.0f;
}

void setup() {
    Serial.begin(115200);
    delay(2000); 

    // Configuração Encoder (INPUT_PULLUP ativa os resistores internos para encoders Open-Collector)
    pinMode(PIN_A, INPUT_PULLUP);
    pinMode(PIN_B, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(PIN_A), isr_A, CHANGE);
    attachInterrupt(digitalPinToInterrupt(PIN_B), isr_B, CHANGE);

    // Inicialização do I2C nos pinos G8 e G9
    pinMode(PIN_SDA, INPUT_PULLUP);
    pinMode(PIN_SCL, INPUT_PULLUP);
    Wire.begin(PIN_SDA, PIN_SCL);
    Wire.setTimeOut(100); 
    delay(500);
    
    wakeIMU(IMU_ADDR);

    // Inicialização do Wi-Fi/ESP-NOW para RECEPÇÃO
    WiFi.disconnect(true);
    delay(200);
    WiFi.mode(WIFI_STA);
    delay(300);
    
    if (esp_now_init() != ESP_OK) {
        Serial.println("ERRO: Falha ao inicializar ESP-NOW");
    }
    
    // Registra a função que trata os dados recebidos
    esp_now_register_recv_cb(OnDataRecv);

    ultimo_tempo_encoder = millis();
    
    Serial.println("");
    Serial.flush();
    // Cabeçalho atualizado sem os dados de Giroscópio
    Serial.println("time,L_Ax,L_Ay,L_Az,R_Ax,R_Ay,R_Az,Pulsos,Vel_ms");
    Serial.flush();
}

void loop() {
    unsigned long agora = millis();

    // Executa o bloco principal estritamente a cada 10ms
    if (agora - ultima_amostra < 8) return;
    ultima_amostra = agora;

    float lax, lay, laz;

    // 1. Cálculo Periódico da Velocidade (Executa internamente a cada 100ms)
    if (agora - ultimo_tempo_encoder >= INTERVALO_MS) {
        noInterrupts();
        long contagem_atual = contagem;
        interrupts();

        long delta_pulsos = contagem_atual - contagem_anterior;
        
        // Correção de Tipo: garante cálculo em ponto flutuante puro (float)
        float delta_tempo_s = (float)(agora - ultimo_tempo_encoder) / 1000.0f;
        
        if (delta_tempo_s > 0.0f) {
            float circunferencia = PI * DIAMETRO_M;
            
            // Convertendo explicitamente todas as constantes matemáticas para float
            float voltas = (float)delta_pulsos / ((float)PPR * (float)MODO_X4);
            velocidade_ms = (voltas * circunferencia) / delta_tempo_s;
        } else {
            velocidade_ms = 0.0f;
        }

        contagem_anterior = contagem_atual;
        ultimo_tempo_encoder = agora;
    }

    // 2. Leitura da MPU Local (Carretilha) - Apenas Acelerômetro
    readIMU(IMU_ADDR, &lax, &lay, &laz);

    // 3. Saída Serial Unificada Sincronizada (Formato CSV)
    Serial.print(agora); Serial.print(",");
    
    // Dados Locais (Carretilha)
    Serial.print(lax, 4); Serial.print(",");
    Serial.print(lay, 4); Serial.print(",");
    Serial.print(laz, 4); Serial.print(",");

    // Dados Remotos (Atleta via ESP-NOW)
    if (novoDadoAtleta) {
        Serial.print(dadosAtleta.ax, 4); Serial.print(",");
        Serial.print(dadosAtleta.ay, 4); Serial.print(",");
        Serial.print(dadosAtleta.az, 4); Serial.print(",");
        novoDadoAtleta = false;
    } else {
        // Preenche com 0 caso não tenha recebido pacotes novos neste frame de 10ms
        Serial.print("0.0000,0.0000,0.0000,");
    }

    // Coleta estável da contagem total de pulsos do encoder
    noInterrupts();
    long pulsos_envio = contagem;
    interrupts();

    Serial.print(pulsos_envio); Serial.print(",");
    Serial.println(velocidade_ms, 3);
}