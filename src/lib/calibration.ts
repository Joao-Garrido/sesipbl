// Calibracao da distancia/velocidade da carretilha.
//
// Dois modos, escolhidos pelo treinador na plataforma (Configuracoes):
//   firmware  -> confia nos valores Vel_ms/Pulsos da ESP (diametro 0.068 m). PADRAO.
//   frontend  -> aplica correcao de campo (roda 0.05 m x fator 1.5) no navegador.
//
// `getCalibration` e uma funcao PURA (sem estado, sem efeitos): dado o modo,
// devolve quantos metros vale cada pulso e o fator que escala a velocidade da ESP.

export type CalibrationMode = "firmware" | "frontend";

export interface Calibration {
  /** Metros por pulso do encoder (distancia = (pulsos - p0) * metersPerPulse). */
  metersPerPulse: number;
  /** Fator aplicado a Vel_ms da ESP (1 = sem correcao). */
  velFactor: number;
}

// Encoder: 600 PPR x4 quadratura = 2400 transicoes/volta.
export const PULSES_PER_REV = 2400;

// Firmware: a ESP calcula com este diametro, entao reproduzimos para a distancia.
const FIRMWARE_DIAMETER_M = 0.068;
const FIRMWARE_MPP = (Math.PI * FIRMWARE_DIAMETER_M) / PULSES_PER_REV;

// Frontend: medicao de campo da roda (0.05 m) com fator de ajuste empirico (1.5).
const FRONTEND_DIAMETER_M = 0.05;
const DISTANCE_CALIBRATION = 1.5;
const FRONTEND_MPP =
  ((Math.PI * FRONTEND_DIAMETER_M) / PULSES_PER_REV) * DISTANCE_CALIBRATION;

export function getCalibration(mode: CalibrationMode): Calibration {
  if (mode === "frontend") {
    return {
      metersPerPulse: FRONTEND_MPP,
      // Mesma correcao da distancia aplicada a velocidade da ESP.
      velFactor: FRONTEND_MPP / FIRMWARE_MPP,
    };
  }
  // Padrao seguro: qualquer valor != "frontend" cai no firmware.
  return { metersPerPulse: FIRMWARE_MPP, velFactor: 1 };
}
