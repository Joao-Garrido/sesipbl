import { describe, it, expect } from "vitest";
import { launchAnglePeak, exitVelocityMean, repeatabilityScore } from "./analysis";
import type { VelocityPoint } from "./types";

// Consistencia = REPETIBILIDADE entre tentativas (coef. de variacao).
// CV = desvio-padrao / media. Score = clamp(0,100, round((1 - CV) * 100)).
// Quanto mais parecidas as tentativas, maior o score. Metrica de SESSAO.
describe("repeatabilityScore", () => {
  it("valores identicos: CV 0 -> 100%", () => {
    expect(repeatabilityScore([10, 10, 10])).toBe(100);
  });

  it("pouca variacao: score alto (<100)", () => {
    // media 10, desvio-pop sqrt(2/3)=0.816, CV 0.0816 -> 92
    expect(repeatabilityScore([9, 10, 11])).toBe(92);
  });

  it("mais variacao: score menor", () => {
    // media 10, desvio-pop sqrt(8/3)=1.633, CV 0.1633 -> 84
    expect(repeatabilityScore([8, 10, 12])).toBe(84);
  });

  it("menos de 2 valores: null (nao da pra medir repetibilidade)", () => {
    expect(repeatabilityScore([10])).toBeNull();
    expect(repeatabilityScore([])).toBeNull();
  });

  it("media <= 0: null (CV indefinido)", () => {
    expect(repeatabilityScore([0, 0])).toBeNull();
    expect(repeatabilityScore([-1, 1])).toBeNull();
  });

  it("variacao enorme: nunca abaixo de 0", () => {
    expect(repeatabilityScore([1, 100])).toBeGreaterThanOrEqual(0);
  });
});

// Reproduz a selecao do angulo_fio.py: find_peaks no sinal de angulo e
// pega o pico de MAIOR amplitude. Valor unico, nao muda durante a corrida.
describe("launchAnglePeak", () => {
  it("dois picos: retorna o de maior amplitude", () => {
    const angles = [0, 10, 25, 10, 0, 15, 40, 15, 0];
    expect(launchAnglePeak(angles)).toBe(40);
  });

  it("um pico: retorna o pico", () => {
    const angles = [0, 5, 30, 5, 0];
    expect(launchAnglePeak(angles)).toBe(30);
  });

  it("monotonico crescente (sem pico interno): cai no maximo global", () => {
    const angles = [0, 10, 20, 30, 40];
    expect(launchAnglePeak(angles)).toBe(40);
  });

  it("monotonico decrescente (sem pico interno): cai no maximo global", () => {
    const angles = [40, 30, 20, 10, 0];
    expect(launchAnglePeak(angles)).toBe(40);
  });

  it("vazio: retorna 0", () => {
    expect(launchAnglePeak([])).toBe(0);
  });
});

// Reproduz ajuste_plot_vel.py: vel_saida = media dos primeiros N pontos.
describe("exitVelocityMean", () => {
  const mk = (vs: number[]): VelocityPoint[] =>
    vs.map((v, i) => ({ t: i * 0.1, d: i, v }));

  it("media dos primeiros N pontos", () => {
    expect(exitVelocityMean(mk([2, 4, 6]), 3)).toBeCloseTo(4);
  });

  it("limita aos primeiros N quando ha mais pontos", () => {
    expect(exitVelocityMean(mk([10, 20, 999, 999]), 2)).toBeCloseTo(15);
  });

  it("usa todos quando ha menos que N", () => {
    expect(exitVelocityMean(mk([3, 5]), 200)).toBeCloseTo(4);
  });

  it("vazio: retorna 0", () => {
    expect(exitVelocityMean([], 200)).toBe(0);
  });
});
