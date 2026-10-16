import { INNER_LENGTH, INNER_WIDTH } from '../config/setup'

/**
 * Experiment configuration — the single place to describe a trial.
 *
 * Nothing here models real acoustic physics or insect behaviour yet. The fields are the
 * hooks the scene and future modules read, so a trial can be described as data first and
 * simulated later. Visual effects driven by these values are illustrations, not evidence.
 */
export const EXPERIMENT = {
  name: 'Baseline — no treatment',

  /** One entry per corner speaker. `pillar` matches CORNER_PILLARS ids in config/setup.js. */
  speakers: [
    { id: 'SPK-FL', pillar: 'FL', enabled: false, frequencyHz: 20000, levelDb: 70, dutyCycle: 1, zone: 'A' },
    { id: 'SPK-BL', pillar: 'BL', enabled: false, frequencyHz: 20000, levelDb: 70, dutyCycle: 1, zone: 'A' },
    { id: 'SPK-FR', pillar: 'FR', enabled: false, frequencyHz: 20000, levelDb: 70, dutyCycle: 1, zone: 'B' },
    { id: 'SPK-BR', pillar: 'BR', enabled: false, frequencyHz: 20000, levelDb: 70, dutyCycle: 1, zone: 'B' },
  ],

  /** Environmental sensor enclosures (front pillars in the reference). Height is above soil. */
  sensors: [
    { id: 'ENV-FL', pillar: 'FL', mountHeight: 1.0, kind: 'temp/humidity/light' },
    { id: 'ENV-FR', pillar: 'FR', mountHeight: 1.0, kind: 'temp/humidity/light' },
  ],

  /**
   * Treated vs. untreated areas, as axis-aligned rectangles on the soil (world X/Z, metres).
   * Default split: left half = Zone A (treated), right half = Zone B (control).
   * In a real trial you would also randomise sides and use acoustic separation between zones.
   */
  zones: [
    {
      id: 'A',
      label: 'Zone A · treated',
      role: 'treated',
      color: '#3d7bd9',
      rect: { x0: -INNER_LENGTH / 2, x1: 0, z0: -INNER_WIDTH / 2, z1: INNER_WIDTH / 2 },
    },
    {
      id: 'B',
      label: 'Zone B · control',
      role: 'control',
      color: '#e08a2c',
      rect: { x0: 0, x1: INNER_LENGTH / 2, z0: -INNER_WIDTH / 2, z1: INNER_WIDTH / 2 },
    },
  ],

  insects: {
    enabled: false,
    count: 0,
    model: 'null', // see experiment/insects/insectModel.js
  },

  vision: {
    captureWidth: 1024,
    captureHeight: 576,
  },
}
