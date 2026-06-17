#include <Wire.h>

#define IMU_ADDR 0x68

#define PIN_A 4
#define PIN_B 5

#define PIN_SDA 8
#define PIN_SCL 9

#define PPR          600
#define MODO_X4      4
#define DIAMETRO_M   0.068   // ?
#define INTERVALO_MS 100

#define REG_ACCEL_XOUT_H 0x3B
#define REG_PWR_MGMT_1   0x6B

volatile long contagem = 0;
long contagem_anterior = 0;
unsigned long ultimo_tempo_encoder = 0;
float velocidade_ms = 0;

unsigned long ultima_amostra = 0;

void IRAM_ATTR isr_A() {
  digitalRead(PIN_A) == digitalRead(PIN_B) ? contagem-- : contagem++;
}

void IRAM_ATTR isr_B() {
  digitalRead(PIN_A) != digitalRead(PIN_B) ? contagem-- : contagem++;
}

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

// Inclinação sempre para a esquerda: ax vai de 0 a -1g
// asin(-ax_clamped) retorna 0° a 90°
float calcularAngulo(float ax) {
    float ax_clamped = constrain(ax, -1.0f, 0.0f);
    return asinf(ax_clamped) * (180.0f / PI);
}

void setup() {
    Serial.begin(115200);
    delay(2000);

    // Encoder (intocado)
    pinMode(PIN_A, INPUT_PULLUP);
    pinMode(PIN_B, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(PIN_A), isr_A, CHANGE);
    attachInterrupt(digitalPinToInterrupt(PIN_B), isr_B, CHANGE);

    // I2C
    pinMode(PIN_SDA, INPUT_PULLUP);
    pinMode(PIN_SCL, INPUT_PULLUP);
    Wire.begin(PIN_SDA, PIN_SCL);
    Wire.setTimeOut(100);
    delay(500);

    wakeIMU(IMU_ADDR);

    ultimo_tempo_encoder = millis();

    Serial.println("");
    Serial.flush();
    Serial.println("time,Ax,Angulo_graus,Pulsos,Vel_ms");
    Serial.flush();
}

void loop() {
    unsigned long agora = millis();

    if (agora - ultima_amostra < 8) return;
    ultima_amostra = agora;

    float ax, ay, az;

    // 1. Velocidade (intocado)
    if (agora - ultimo_tempo_encoder >= INTERVALO_MS) {
        noInterrupts();
        long contagem_atual = contagem;
        interrupts();

        long delta_pulsos = contagem_atual - contagem_anterior;
        float delta_tempo_s = (float)(agora - ultimo_tempo_encoder) / 1000.0f;

        if (delta_tempo_s > 0.0f) {
            float circunferencia = PI * DIAMETRO_M;
            float voltas = (float)delta_pulsos / ((float)PPR * (float)MODO_X4);
            velocidade_ms = (voltas * circunferencia) / delta_tempo_s;
        } else {
            velocidade_ms = 0.0f;
        }

        contagem_anterior = contagem_atual;
        ultimo_tempo_encoder = agora;
    }

    // 2. Leitura IMU
    readIMU(IMU_ADDR, &ax, &ay, &az);

    // 3. Ângulo
    float angulo = calcularAngulo(ax);

    // 4. Serial
    Serial.print(agora);      Serial.print(",");
    Serial.print(ax, 4);      Serial.print(",");
    Serial.print(angulo, 2);  Serial.print(",");

    noInterrupts();
    long pulsos_envio = contagem;
    interrupts();

    Serial.print(pulsos_envio); Serial.print(",");
    Serial.println(velocidade_ms, 3);
}