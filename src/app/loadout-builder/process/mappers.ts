import { D2ManifestDefinitions } from 'app/destiny2/d2-definitions';
import { knownModPlugCategoryHashes } from 'app/loadout/known-values';
import { modsWithConditionalStats } from 'app/search/d2-known-values';
import { chargedWithLightPlugCategoryHashes } from 'app/search/specialty-modslots';
import { UpgradeSpendTier } from 'app/settings/initial-settings';
import {
  DestinyClass,
  DestinyEnergyType,
  DestinyItemInvestmentStatDefinition,
} from 'bungie-api-ts/destiny2';
import { StatHashes } from 'data/d2/generated-enums';
import raidModPlugCategoryHashes from 'data/d2/raid-mod-plug-category-hashes.json';
import _ from 'lodash';
import { DimItem, PluggableInventoryItemDefinition } from '../../inventory/item-types';
import {
  getModTypeTagByPlugCategoryHash,
  getSpecialtySocketMetadatas,
} from '../../utils/item-utils';
import { ProcessArmorSet, ProcessItem, ProcessMod } from '../process-worker/types';
import { ArmorSet, statHashToType, StatTypes } from '../types';
import { canSwapEnergyFromUpgradeSpendTier, upgradeSpendTierToMaxEnergy } from '../utils';

export function mapArmor2ModToProcessMod(mod: PluggableInventoryItemDefinition): ProcessMod {
  const processMod: ProcessMod = {
    hash: mod.hash,
    plugCategoryHash: mod.plug.plugCategoryHash,
    energy: mod.plug.energyCost && {
      type: mod.plug.energyCost.energyType,
      val: mod.plug.energyCost.energyCost,
    },
    investmentStats: mod.investmentStats,
  };

  if (
    raidModPlugCategoryHashes.includes(processMod.plugCategoryHash) ||
    !knownModPlugCategoryHashes.includes(processMod.plugCategoryHash)
  ) {
    processMod.tag = getModTypeTagByPlugCategoryHash(mod.plug.plugCategoryHash);
  }

  return processMod;
}

function isModStatActive(
  characterClass: DestinyClass,
  plugHash: number,
  stat: DestinyItemInvestmentStatDefinition,
  lockedMods: PluggableInventoryItemDefinition[]
): boolean {
  if (!stat.isConditionallyActive) {
    return true;
  } else if (
    plugHash === modsWithConditionalStats.powerfulFriends ||
    plugHash === modsWithConditionalStats.radiantLight
  ) {
    // Powerful Friends & Radiant Light
    // True if another arc charged with light mod is found
    // Note the this is not entirely correct as another arc mod slotted into the same item would
    // also trigger it but we dont know that until we try to socket them. Basically it is too hard
    // to figure that condition out so lets leave it as a known issue for now.
    return Boolean(
      lockedMods.find(
        (mod) =>
          mod.plug.energyCost?.energyType === DestinyEnergyType.Arc &&
          chargedWithLightPlugCategoryHashes.includes(mod.plug.plugCategoryHash)
      )
    );
  } else if (plugHash === modsWithConditionalStats.chargeHarvester) {
    // Charge Harvester
    return (
      (characterClass === DestinyClass.Hunter && stat.statTypeHash === StatHashes.Mobility) ||
      (characterClass === DestinyClass.Titan && stat.statTypeHash === StatHashes.Resilience) ||
      (characterClass === DestinyClass.Warlock && stat.statTypeHash === StatHashes.Recovery)
    );
  } else {
    return true;
  }
}

/**
 * This sums up the total stat contributions across mods passed in. These are then applied
 * to the loadouts after all the items base values have been summed. This mimics how mods
 * effect stat values in game and allows us to do some preprocessing.
 */
export function getTotalModStatChanges(
  lockedMods: PluggableInventoryItemDefinition[],
  characterClass: DestinyClass | undefined
) {
  const totals: { [stat in StatTypes]: number } = {
    Mobility: 0,
    Recovery: 0,
    Resilience: 0,
    Intellect: 0,
    Discipline: 0,
    Strength: 0,
  };

  // This should only happen on initialisation if the store is undefined.
  if (characterClass === undefined) {
    return totals;
  }

  for (const mod of lockedMods) {
    for (const stat of mod.investmentStats) {
      const statType = statHashToType[stat.statTypeHash];
      if (statType && isModStatActive(characterClass, mod.hash, stat, lockedMods)) {
        totals[statType] += stat.value;
      }
    }
  }

  return totals;
}

export function mapDimItemToProcessItem(
  defs: D2ManifestDefinitions,
  dimItem: DimItem,
  upgradeSpendTier: UpgradeSpendTier,
  modsForSlot?: PluggableInventoryItemDefinition[]
): ProcessItem {
  const { bucket, id, hash, type, name, equippingLabel, basePower, stats, energy } = dimItem;

  const baseStatMap: { [statHash: number]: number } = {};

  if (stats) {
    for (const { statHash, base } of stats) {
      baseStatMap[statHash] = base;
    }
  }

  const modMetadatas = getSpecialtySocketMetadatas(dimItem);
  const modsCost = modsForSlot
    ? _.sumBy(modsForSlot, (mod) => mod.plug.energyCost?.energyCost || 0)
    : 0;

  // If we have slot specifc mods an energy type has effectively been chosen.
  let energyType = modsForSlot?.find(
    (mod) => mod.plug.energyCost?.energyType !== DestinyEnergyType.Any
  )?.plug.energyCost?.energyType;

  if (!energyType && canSwapEnergyFromUpgradeSpendTier(defs, upgradeSpendTier, dimItem)) {
    energyType = DestinyEnergyType.Any;
  }

  return {
    bucketHash: bucket.hash,
    id,
    hash,
    type,
    name,
    equippingLabel,
    basePower,
    baseStats: baseStatMap,
    energy: energy
      ? {
          type: energyType ?? energy.energyType,
          capacity: upgradeSpendTierToMaxEnergy(defs, upgradeSpendTier, dimItem),
          val: modsCost,
        }
      : undefined,
    compatibleModSeasons: modMetadatas?.flatMap((m) => m.compatibleModTags),
    hasLegacyModSocket: Boolean(modMetadatas?.some((m) => m.slotTag === 'legacy')),
  };
}

export function hydrateArmorSet(
  processed: ProcessArmorSet,
  itemsById: Map<string, DimItem[]>
): ArmorSet {
  const armor: DimItem[][] = [];

  for (const itemId of processed.armor) {
    armor.push(itemsById.get(itemId)!);
  }

  return {
    armor,
    stats: processed.stats,
  };
}
