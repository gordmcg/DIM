import { D2ManifestDefinitions } from 'app/destiny2/d2-definitions';
import { knownModPlugCategoryHashes } from 'app/loadout/known-values';
import { armor2PlugCategoryHashesByName } from 'app/search/d2-known-values';
import { UpgradeSpendTier } from 'app/settings/initial-settings';
import { DestinyEnergyType } from 'bungie-api-ts/destiny2';
import raidModPlugCategoryHashes from 'data/d2/raid-mod-plug-category-hashes.json';
import _ from 'lodash';
import { DimItem, PluggableInventoryItemDefinition } from '../inventory/item-types';
import {
  canTakeSlotIndependantMods,
  generateModPermutations,
} from './process-worker/process-utils';
import { ProcessItem } from './process-worker/types';
import { mapArmor2ModToProcessMod, mapDimItemToProcessItem } from './process/mappers';
import { bucketsToCategories, LockableBucketHashes } from './types';
import { canSwapEnergyFromUpgradeSpendTier } from './utils';

/**
 * Checks that:
 *   1. The armour piece is Armour 2.0
 *   2. The mod matches the Armour energy OR the mod has the any Energy type
 */
export const doEnergiesMatch = (
  defs: D2ManifestDefinitions,
  mod: PluggableInventoryItemDefinition,
  item: DimItem,
  upgradeSpendTier: UpgradeSpendTier
) =>
  item.energy &&
  (!mod.plug.energyCost ||
    mod.plug.energyCost.energyType === DestinyEnergyType.Any ||
    mod.plug.energyCost.energyType === item.energy.energyType ||
    canSwapEnergyFromUpgradeSpendTier(defs, upgradeSpendTier, item));

/**
 * If the energies match, this will assign the mods to the item in assignments.
 *
 * assignments is mutated in this function as it tracks assigned mods for a particular armour set
 */
function assignModsForSlot(
  defs: D2ManifestDefinitions,
  item: DimItem,
  assignments: Record<string, number[]>,
  upgradeSpendTier: UpgradeSpendTier,
  mods?: PluggableInventoryItemDefinition[]
): void {
  if (mods?.length && mods.every((mod) => doEnergiesMatch(defs, mod, item, upgradeSpendTier))) {
    assignments[item.id] = [...assignments[item.id], ...mods.map((mod) => mod.hash)];
  }
}

/**
 * Checks to see if the passed in general and other mods can be assigned to the armour set.
 *
 * assignments is mutated in this function as it tracks assigned mods for a particular armour set
 */
function assignSlotIndependantMods(
  setToMatch: ProcessItem[],
  lockedMods: PluggableInventoryItemDefinition[],
  assignments: Record<string, number[]>
): void {
  const generalMods: PluggableInventoryItemDefinition[] = [];
  const otherMods: PluggableInventoryItemDefinition[] = [];
  const raidMods: PluggableInventoryItemDefinition[] = [];

  for (const mod of lockedMods) {
    const { plugCategoryHash } = mod.plug;
    if (plugCategoryHash === armor2PlugCategoryHashesByName.general) {
      generalMods.push(mod);
    } else if (raidModPlugCategoryHashes.includes(plugCategoryHash)) {
      raidMods.push(mod);
    } else if (!knownModPlugCategoryHashes.includes(plugCategoryHash)) {
      otherMods.push(mod);
    }
  }

  if (!generalMods || !otherMods || !raidMods) {
    return;
  }

  // Mods need to be sorted before being passed to the assignment function
  const generalProcessMods = generalMods.map(mapArmor2ModToProcessMod);
  const otherProcessMods = otherMods.map(mapArmor2ModToProcessMod);
  const raidProcessMods = raidMods.map(mapArmor2ModToProcessMod);

  const generalModPermutations = generateModPermutations(generalProcessMods);
  const otherModPermutations = generateModPermutations(otherProcessMods);
  const raidModPermutations = generateModPermutations(raidProcessMods);

  canTakeSlotIndependantMods(
    generalModPermutations,
    otherModPermutations,
    raidModPermutations,
    setToMatch,
    assignments
  );
}

export function assignModsToArmorSet(
  defs: D2ManifestDefinitions | undefined,
  setToMatch: readonly DimItem[],
  lockedMods: PluggableInventoryItemDefinition[],
  upgradeSpendTier: UpgradeSpendTier
): [Record<string, PluggableInventoryItemDefinition[]>, PluggableInventoryItemDefinition[]] {
  const assignments: Record<string, number[]> = {};

  for (const item of setToMatch) {
    assignments[item.id] = [];
  }

  const processItems: ProcessItem[] = [];
  const lockedModMap = _.groupBy(lockedMods, (mod) => mod.plug.plugCategoryHash);

  for (const hash of LockableBucketHashes) {
    const item = setToMatch.find((i) => i.bucket.hash === hash);

    if (item && defs) {
      const lockedModsByPlugCategoryHash = lockedModMap[bucketsToCategories[hash]];
      assignModsForSlot(defs, item, assignments, upgradeSpendTier, lockedModsByPlugCategoryHash);
      processItems.push(
        mapDimItemToProcessItem(defs, item, upgradeSpendTier, lockedModsByPlugCategoryHash)
      );
    }
  }

  assignSlotIndependantMods(processItems, lockedMods, assignments);

  const modsByHash = _.groupBy(lockedMods, (mod) => mod.hash);

  // In this we map modHashes to their mod using modsByHash. Note that we pop the mod from the
  // array in modByHash, this will leave us with any unassigned mods left in modsByHash
  const assignedMods = _.mapValues(assignments, (modHashes) =>
    modHashes
      .map((modHash) => modsByHash[modHash].pop())
      // This shouldn't happen but lets throw in a filter for saftey and type happyness
      .filter((x): x is PluggableInventoryItemDefinition => Boolean(x))
  );

  const unassignedMods = Object.values(modsByHash).flat();

  return [assignedMods, unassignedMods];
}

/**
 * Checks to see if some mod in a collection of LockedMod or LockedMod,
 * has an elemental (non-Any) energy requirement
 */
export function someModHasEnergyRequirement(mods: PluggableInventoryItemDefinition[]) {
  return mods.some(
    (mod) => !mod.plug.energyCost || mod.plug.energyCost.energyType !== DestinyEnergyType.Any
  );
}
