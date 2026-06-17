#include <Wire.h>
#include <esp_now.h>
#include <WiFi.h>

// --- Definições de Hardware ---
#define IMU_ADDR 0x68

// --- Pinos I2C Validados e Funcionando ---
#define PIN_SDA 8
#define PIN_SCL 9

// Registradores MPU
#define REG_ACCEL_XOUT_H 0x3B
#define REG_PWR_MGMT_1   0x6B

// Endereço broadcast ESP-NOW
// Assim qualquer ESP-NOW receiver próximo pode receber
uint8_t broadcastAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

// Estrutura para dados do Atleta
// DEVE ser igual à struct da carretilha
typedef struct struct_message {
    float ax, ay, az;
    float gx, gy, gz;
} struct_message;

struct_message dadosAtleta;

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

void readIMU(uint8_t addr, float* ax, float* ay, float* az, float* gx, float* gy, float* gz) {
    int16_t raw[6] = {0, 0, 0, 0, 0, 0};
    
    Wire.beginTransmission(addr);
    Wire.write(REG_ACCEL_XOUT_H);
    
    if (Wire.endTransmission(false) == 0) {
        Wire.requestFrom(addr, (uint8_t)12);
        for (int i = 0; i < 6; i++) {
            if (Wire.available() >= 2) {
                raw[i] = (Wire.read() << 8) | Wire.read();
            }
        }
    }
    
    *ax = raw[0] / 4096.0f; 
    *ay = raw[1] / 4096.0f; 
    *az = raw[2] / 4096.0f;
    *gx = raw[3] / 131.0f;  
    *gy = raw[4] / 131.0f;  
    *gz = raw[5] / 131.0f;
}

void setup() {
    Serial0.begin(115200);
    delay(2000);

    // Inicialização do I2C nos pinos G8 e G9
    pinMode(PIN_SDA, INPUT_PULLUP);
    pinMode(PIN_SCL, INPUT_PULLUP);
    Wire.begin(PIN_SDA, PIN_SCL);
    Wire.setTimeOut(100);
    delay(500);

    wakeIMU(IMU_ADDR);

    // Inicialização do Wi-Fi/ESP-NOW
    WiFi.disconnect(true);
    delay(200);
    WiFi.mode(WIFI_STA);
    delay(300);

    if (esp_now_init() != ESP_OK) {
        Serial0.println("ERRO: Falha ao inicializar ESP-NOW");
        return;
    }

    esp_now_peer_info_t peerInfo = {};
    memcpy(peerInfo.peer_addr, broadcastAddress, 6);
    peerInfo.channel = 0;
    peerInfo.encrypt = false;

    if (esp_now_add_peer(&peerInfo) != ESP_OK) {
        Serial0.println("ERRO: Falha ao adicionar peer ESP-NOW");
        return;
    }

    Serial0.println("");
    Serial0.println("ESP Atleta iniciado");
    Serial0.println("Time,Ax,Ay,Az,Gx,Gy,Gz,SendStatus");
}

unsigned long ultima_amostra = 0;

void loop() {
    unsigned long agora = millis();

    if (agora - ultima_amostra < 10) return;
    ultima_amostra = agora;

    // 1. Leitura da MPU do atleta
    readIMU(
        IMU_ADDR,
        &dadosAtleta.ax,
        &dadosAtleta.ay,
        &dadosAtleta.az,
        &dadosAtleta.gx,
        &dadosAtleta.gy,
        &dadosAtleta.gz
    );

    // 2. Envio dos dados por ESP-NOW
    esp_err_t result = esp_now_send(
        broadcastAddress,
        (uint8_t*) &dadosAtleta,
        sizeof(dadosAtleta)
    );

    // 3. Debug serial local
    Serial0.print(agora); Serial0.print(",");
    Serial0.print(dadosAtleta.ax, 4); Serial0.print(",");
    Serial0.print(dadosAtleta.ay, 4); Serial0.print(",");
    Serial0.print(dadosAtleta.az, 4); Serial0.print(",");
    Serial0.print(dadosAtleta.gx, 4); Serial0.print(",");
    Serial0.print(dadosAtleta.gy, 4); Serial0.print(",");
    Serial0.print(dadosAtleta.gz, 4); Serial0.print(",");

    if (result == ESP_OK) {
        Serial0.println("OK");
    } else {
        Serial0.println("FAIL");
    }
}