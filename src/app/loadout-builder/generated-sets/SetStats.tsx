import BungieImage from 'app/dim-ui/BungieImage';
import PressTip from 'app/dim-ui/PressTip';
import { t } from 'app/i18next-t';
import { useD2Definitions } from 'app/manifest/selectors';
import { AppIcon, powerIndicatorIcon } from 'app/shell/icons';
import StatTooltip from 'app/store-stats/StatTooltip';
import { DestinyClass, DestinyStatDefinition } from 'bungie-api-ts/destiny2';
import clsx from 'clsx';
import _ from 'lodash';
import React from 'react';
import { statHashes, StatTypes } from '../types';
import { statTierWithHalf } from '../utils';
import styles from './SetStats.m.scss';
import { calculateTotalTier, sumEnabledStats } from './utils';

interface Props {
  stats: Readonly<{ [statType in StatTypes]: number }>;
  maxPower: number;
  statOrder: StatTypes[];
  enabledStats: Set<StatTypes>;
  characterClass?: DestinyClass;
  className?: string;
  existingLoadoutName?: string;
}

function SetStats({
  stats,
  maxPower,
  statOrder,
  enabledStats,
  characterClass,
  className,
  existingLoadoutName,
}: Props) {
  const defs = useD2Definitions()!;
  const statsDefs = _.mapValues(statHashes, (statHash) => defs.Stat.get(statHash));
  const totalTier = calculateTotalTier(stats);
  const enabledTier = sumEnabledStats(stats, enabledStats);

  const displayStats = { ...stats };

  return (
    <div className={clsx(styles.container, className)}>
      <div className={styles.tierLightContainer}>
        <span className={styles.tierLightSegment}>
          <b>
            {t('LoadoutBuilder.TierNumber', {
              tier: enabledTier,
            })}
          </b>
        </span>
        {enabledTier !== totalTier && (
          <span className={styles.nonActiveStat}>
            <b>
              {` (${t('LoadoutBuilder.TierNumber', {
                tier: totalTier,
              })})`}
            </b>
          </span>
        )}
        <span className={styles.light}>
          <AppIcon icon={powerIndicatorIcon} /> {maxPower}
        </span>
        {existingLoadoutName ? (
          <span className={styles.existingLoadout}>
            {t('LoadoutBuilder.ExistingLoadout')}:{' '}
            <span className={styles.loadoutName}>{existingLoadoutName}</span>
          </span>
        ) : null}
      </div>
      <div className={styles.statSegmentContainer}>
        {statOrder.map((stat) => (
          <PressTip
            key={stat}
            tooltip={
              <StatTooltip
                stat={{
                  hash: statsDefs[stat].hash,
                  name: statsDefs[stat].displayProperties.name,
                  value: displayStats[stat],
                  description: statsDefs[stat].displayProperties.description,
                }}
                characterClass={characterClass}
              />
            }
            allowClickThrough={true}
          >
            <Stat
              isActive={enabledStats.has(stat)}
              stat={statsDefs[stat]}
              value={displayStats[stat]}
            />
          </PressTip>
        ))}
      </div>
    </div>
  );
}

function Stat({
  stat,
  isActive,
  value,
}: {
  stat: DestinyStatDefinition;
  isActive: boolean;
  value: number;
}) {
  return (
    <span
      className={clsx(styles.statSegment, {
        [styles.nonActiveStat]: !isActive,
      })}
    >
      <span
        className={clsx({
          [styles.halfTierValue]: isActive && value % 10 >= 5,
        })}
      >
        <b>
          {t('LoadoutBuilder.TierNumber', {
            tier: statTierWithHalf(value),
          })}
        </b>
      </span>
      <BungieImage src={stat.displayProperties.icon} /> {stat.displayProperties.name}
    </span>
  );
}

export default SetStats;
