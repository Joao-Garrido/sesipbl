import { describe, it, expect } from "vitest";
import { getCalibration, type CalibrationMode } from "./calibration";

// Encoder: 600 PPR x4 quadratura = 2400 transicoes/volta.
const PULSES_PER_REV = 2400;
const FIRMWARE_MPP = (Math.PI * 0.068) / PULSES_PER_REV; // diametro firmware 0.068 m
const FRONTEND_MPP = ((Math.PI * 0.05) / PULSES_PER_REV) * 1.5; // campo 0.05 m x 1.5

describe("getCalibration", () => {
  it("firmware: confia na ESP (velFactor 1, MPP do diametro 0.068)", () => {
    const cal = getCalibration("firmware");
    expect(cal.velFactor).toBe(1);
    expect(cal.metersPerPulse).toBeCloseTo(FIRMWARE_MPP, 12);
  });

  it("frontend: correcao de campo 0.05 m x 1.5", () => {
    const cal = getCalibration("frontend");
    expect(cal.metersPerPulse).toBeCloseTo(FRONTEND_MPP, 12);
    // fator de campo = 0.075 / 0.068 aplicado a velocidade
    expect(cal.velFactor).toBeCloseTo(0.075 / 0.068, 10);
  });

  it("velFactor = razao dos MPP (mesma correcao em distancia e velocidade)", () => {
    const fw = getCalibration("firmware");
    const fe = getCalibration("frontend");
    expect(fe.velFactor).toBeCloseTo(fe.metersPerPulse / fw.metersPerPulse, 10);
  });

  it("modo invalido cai no firmware (seguro por padrao)", () => {
    const cal = getCalibration("xpto" as CalibrationMode);
    expect(cal.velFactor).toBe(1);
    expect(cal.metersPerPulse).toBeCloseTo(FIRMWARE_MPP, 12);
  });
});
