import { PetState } from '../types';
import { serverTimestamp } from '../firebase';

const FOREST_THRESHOLD_MS = 10 * 60 * 60 * 1000; // 10 hours
const RECOVERY_THRESHOLD_MS = 5 * 60 * 60 * 1000; // 5 hours

export function calculateForestState(data: PetState): Partial<PetState> {
  const now = new Date().getTime();
  const anyStatIsZero = data.hunger === 0 || data.energy === 0 || data.cleanliness === 0 || data.happiness === 0;
  const allStatsPositive = data.hunger > 0 && data.energy > 0 && data.cleanliness > 0 && data.happiness > 0;

  const updates: Partial<PetState> = {};

  // Track when any stat first hit zero
  if (anyStatIsZero) {
    if (!data.zeroStatsSince) {
      updates.zeroStatsSince = serverTimestamp();
    }
  } else {
    if (data.zeroStatsSince) {
      updates.zeroStatsSince = null;
    }
  }

  // Track when all stats first became positive
  if (allStatsPositive) {
    if (!data.aboveZeroStatsSince) {
      updates.aboveZeroStatsSince = serverTimestamp();
    }
  } else {
    if (data.aboveZeroStatsSince) {
      updates.aboveZeroStatsSince = null;
    }
  }

  // Logic for entering the forest
  if (!data.isAtForest && anyStatIsZero && data.zeroStatsSince) {
    const zeroSince = data.zeroStatsSince.toDate ? data.zeroStatsSince.toDate().getTime() : new Date(data.zeroStatsSince).getTime();
    if (now - zeroSince >= FOREST_THRESHOLD_MS) {
      updates.isAtForest = true;
      updates.lastAction = 'Ушел в лес от одиночества и голода...';
      updates.lastActionBy = 'Система';
    }
  }

  // Logic for leaving the forest
  if (data.isAtForest && allStatsPositive && data.aboveZeroStatsSince) {
    const aboveZeroSince = data.aboveZeroStatsSince.toDate ? data.aboveZeroStatsSince.toDate().getTime() : new Date(data.aboveZeroStatsSince).getTime();
    if (now - aboveZeroSince >= RECOVERY_THRESHOLD_MS) {
      updates.isAtForest = false;
      updates.lastAction = 'Вернулся из леса, почувствовав заботу!';
      updates.lastActionBy = 'Система';
    }
  }

  return updates;
}
