import { AcousticProfile } from '../types';

export interface PestSpeciesInfo {
  id: string;
  scientificName: string;
  commonName: string;
  family: string;
  acousticSensoryOrgan: string;
  literatureAcousticSensitivityKhz: string;
  naturalEvasiveBehavior: string;
  targetCrops: string[];
}

export const PEST_CATALOG: PestSpeciesInfo[] = [
  {
    id: 'helicoverpa_armigera',
    scientificName: 'Helicoverpa armigera',
    commonName: 'Cotton Bollworm / Corn Earworm',
    family: 'Noctuidae (Tympanate moth)',
    acousticSensoryOrgan: 'Metathoracic tympanal organs (A1 & A2 acoustic receptor cells)',
    literatureAcousticSensitivityKhz: '20 kHz – 55 kHz (Peak sensitivity: ~35 kHz)',
    naturalEvasiveBehavior: 'Negative phonotaxis, power-dive or erratic spiraling upon ultrasonic pulse detection',
    targetCrops: ['Cotton', 'Tomato', 'Maize', 'Soybean', 'Chickpea'],
  },
  {
    id: 'spodoptera_frugiperda',
    scientificName: 'Spodoptera frugiperda',
    commonName: 'Fall Armyworm',
    family: 'Noctuidae',
    acousticSensoryOrgan: 'Tympanal organ located in caudal thorax',
    literatureAcousticSensitivityKhz: '22 kHz – 48 kHz',
    naturalEvasiveBehavior: 'Sudden altitude drops, rapid turning away from perceived echolocating predator',
    targetCrops: ['Corn / Maize', 'Rice', 'Sorghum', 'Sugarcane'],
  },
  {
    id: 'plutella_xylostella',
    scientificName: 'Plutella xylostella',
    commonName: 'Diamondback Moth',
    family: 'Plutellidae',
    acousticSensoryOrgan: 'Abdominal tympanal membrane',
    literatureAcousticSensitivityKhz: '30 kHz – 50 kHz (High threshold)',
    naturalEvasiveBehavior: 'Cessation of wingbeat, erratic gliding descent',
    targetCrops: ['Cabbage', 'Broccoli', 'Canola', 'Cauliflower'],
  },
];

export const ACOUSTIC_PROFILES: AcousticProfile[] = [
  {
    id: 'bat_fm_sweep_v1',
    name: 'Bat Echolocation FM Sweep (28–44 kHz)',
    frequencyRange: '28.0 kHz – 44.0 kHz Downward Sweep',
    pulsePattern: '15 ms pulse / 85 ms inter-pulse interval (10 Hz repetition rate)',
    intensityDbSpl: 104,
    dutyCycle: '15% Duty Cycle',
    literatureRef: 'Simulates Pipistrellus search-phase echolocation (Waters & Jones 1995)',
  },
  {
    id: 'bat_pulse_burst_v2',
    name: 'Adaptive Staccato Burst (35 kHz High-Intensity)',
    frequencyRange: '35.0 kHz Carrier ± 3 kHz bandwidth',
    pulsePattern: '8 ms rapid pulses in 5-pulse bursts (200 ms inter-burst pause)',
    intensityDbSpl: 108,
    dutyCycle: '20% Duty Cycle',
    literatureRef: 'Ethemon-type predatory attack buzz emulation (Roeder 1967)',
  },
  {
    id: 'continuous_harmonic_v3',
    name: 'Broadband Ultrasonic Flutter (24–50 kHz)',
    frequencyRange: '24.0 kHz – 50.0 kHz Multi-frequency modulated',
    pulsePattern: 'Continuous triangular FM sweep',
    intensityDbSpl: 98,
    dutyCycle: '45% Duty Cycle',
    literatureRef: 'Experimental deterrence evaluation (Spangler 1988)',
  },
];
