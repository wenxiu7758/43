export interface MahjongTile {
  id: string;
  type: 'wan' | 'tiao' | 'tong' | 'zi';
  value: number; // 1..9 (zi: 1..7 for 东南西北中发白)
  text: string;
  color: string;
  discardBy?: number;
  hidden?: boolean;
  isRedDragon?: boolean;
}

export interface WinningBreakdown {
  fans: string[];
  totalFan: number;
  rewardCoins: number;
  maCount: number;
  rewardMaTiles: MahjongTile[];
  hitMaCount: number;
  payoutPerOpponent: number;
  isFourHongzhong?: boolean;
  kongBonusTotal?: number;
  myKongNet?: number;
  opponentPayouts?: number[];
  winnerSeat?: number;
  netCoinsPerSeat?: number[];
  winningHand?: MahjongTile[];
  winningMelds?: MahjongTile[][];
  winnerNameSnapshot?: string;
}

export const TILE_CHARS: Record<string, string[]> = {
  wan: ['一万', '二万', '三万', '四万', '五万', '六万', '七万', '八万', '九万'],
  tiao: ['一条', '二条', '三条', '四条', '五条', '六条', '七条', '八条', '九条'],
  tong: ['一筒', '二筒', '三筒', '四筒', '五筒', '六筒', '七筒', '八筒', '九筒'],
  zi: ['东风', '南风', '西风', '北风', '红中', '发财', '白板'],
};

export const ALL_TILE_KINDS = [
  ...Array.from({ length: 9 }, (_, i) => ({ type: 'wan' as const, value: i + 1, text: TILE_CHARS.wan[i] })),
  ...Array.from({ length: 9 }, (_, i) => ({ type: 'tiao' as const, value: i + 1, text: TILE_CHARS.tiao[i] })),
  ...Array.from({ length: 9 }, (_, i) => ({ type: 'tong' as const, value: i + 1, text: TILE_CHARS.tong[i] })),
  ...Array.from({ length: 7 }, (_, i) => ({ type: 'zi' as const, value: i + 1, text: TILE_CHARS.zi[i] })),
];

export function isHongzhong(tile: MahjongTile | null | undefined): boolean {
  if (!tile) return false;
  return (tile.type === 'zi' && tile.value === 5) || tile.text === '红中';
}

export function isYiWuJiuMaTile(t: MahjongTile, isFourHongzhong = false): boolean {
  if (isFourHongzhong) return true;
  if (t.type !== 'zi') {
    return t.value === 1 || t.value === 5 || t.value === 9;
  }
  return t.value === 1 || t.value === 5 || t.text === '东风' || t.text === '红中';
}

export function sortMahjongHand(hand: MahjongTile[]): MahjongTile[] {
  const typeOrder = { wan: 0, tiao: 1, tong: 2, zi: 3 };
  return [...hand].sort((a, b) => typeOrder[a.type] - typeOrder[b.type] || a.value - b.value);
}

export function createMahjongTilePool(): MahjongTile[] {
  const pool: MahjongTile[] = [];
  (['wan', 'tiao', 'tong'] as const).forEach((t) => {
    for (let v = 1; v <= 9; v++) {
      for (let copy = 0; copy < 4; copy++) {
        pool.push({
          id: `${t}-${v}-${copy}`,
          type: t,
          value: v,
          text: TILE_CHARS[t][v - 1],
          color: t === 'wan' ? '#DC2626' : (t === 'tiao' ? '#16A34A' : '#2563EB'),
        });
      }
    }
  });
  for (let v = 1; v <= 7; v++) {
    for (let copy = 0; copy < 4; copy++) {
      pool.push({
        id: `zi-${v}-${copy}`,
        type: 'zi',
        value: v,
        text: TILE_CHARS.zi[v - 1],
        color: v === 5 ? '#DC2626' : (v === 6 ? '#16A34A' : '#475569'),
      });
    }
  }
  return pool.sort(() => Math.random() - 0.5);
}

export function normalizeServerMelds(rawMelds: any[]): MahjongTile[][] {
  if (!Array.isArray(rawMelds)) return [];
  return rawMelds
    .map((m: any) => {
      if (Array.isArray(m)) return m;
      if (Array.isArray(m?.tiles) && m.tiles.length > 0) return m.tiles;
      if (m && m.tile) {
        const cnt = m.type === 'gang' ? 4 : 3;
        return Array.from({ length: cnt }, (_, i) => ({ ...m.tile, id: `${m.tile.id}-m-${i}` }));
      }
      return [];
    })
    .filter((arr: MahjongTile[]) => arr.length > 0);
}

export function canDecomposeIntoMelds(vals: number[], isZi = false): boolean {
  if (vals.length === 0) return true;
  if (vals.length % 3 !== 0) return false;

  const arr = [...vals].sort((a, b) => a - b);
  if (arr[0] === arr[1] && arr[1] === arr[2]) {
    const nextArr = arr.slice(3);
    if (canDecomposeIntoMelds(nextArr, isZi)) return true;
  }
  if (!isZi) {
    const v = arr[0];
    const idx2 = arr.indexOf(v + 1);
    const idx3 = arr.indexOf(v + 2);
    if (idx2 !== -1 && idx3 !== -1) {
      const nextArr = [...arr];
      nextArr.splice(idx3, 1);
      nextArr.splice(idx2, 1);
      nextArr.splice(0, 1);
      if (canDecomposeIntoMelds(nextArr, isZi)) return true;
    }
  }
  return false;
}

export function checkMahjongWinLocal(hand: Pick<MahjongTile, 'type' | 'value'>[]): boolean {
  if (hand.length % 3 !== 2) return false;

  if (hand.length === 14) {
    const counts = new Map<string, number>();
    hand.forEach((c) => counts.set(`${c.type}-${c.value}`, (counts.get(`${c.type}-${c.value}`) || 0) + 1));
    let pairCount = 0;
    for (const cnt of counts.values()) {
      if (cnt === 2) pairCount++;
      if (cnt === 4) pairCount += 2;
    }
    if (pairCount === 7) return true;
  }

  const groups: Record<string, number[]> = { wan: [], tiao: [], tong: [], zi: [] };
  hand.forEach((c) => groups[c.type].push(c.value));
  Object.values(groups).forEach((arr) => arr.sort((a, b) => a - b));

  for (const [t, vals] of Object.entries(groups)) {
    for (let i = 0; i < vals.length - 1; i++) {
      if (vals[i] === vals[i + 1]) {
        const testGroups: Record<string, number[]> = {
          wan: [...groups.wan],
          tiao: [...groups.tiao],
          tong: [...groups.tong],
          zi: [...groups.zi],
        };
        testGroups[t].splice(i, 2);

        let allValid = true;
        for (const [subT, subVals] of Object.entries(testGroups)) {
          if (!canDecomposeIntoMelds(subVals, subT === 'zi')) {
            allValid = false;
            break;
          }
        }
        if (allValid) return true;
      }
    }
  }

  return false;
}

const suitWildcardCache = new Map<string, number>();

export function minWildcardsForSuit(arr: number[]): number {
  if (arr.length === 0) return 0;
  if (suitWildcardCache.size > 5000) suitWildcardCache.clear();
  const key = arr.join(',');
  if (suitWildcardCache.has(key)) return suitWildcardCache.get(key)!;

  const v = arr[0];
  let minCost = 999;

  const countV = arr.filter((x) => x === v).length;
  if (countV >= 3) {
    const nextArr = [...arr];
    nextArr.splice(nextArr.indexOf(v), 1);
    nextArr.splice(nextArr.indexOf(v), 1);
    nextArr.splice(nextArr.indexOf(v), 1);
    minCost = Math.min(minCost, minWildcardsForSuit(nextArr));
  }
  if (countV >= 2) {
    const nextArr = [...arr];
    nextArr.splice(nextArr.indexOf(v), 1);
    nextArr.splice(nextArr.indexOf(v), 1);
    minCost = Math.min(minCost, 1 + minWildcardsForSuit(nextArr));
  }
  {
    const nextArr = [...arr];
    nextArr.splice(nextArr.indexOf(v), 1);
    minCost = Math.min(minCost, 2 + minWildcardsForSuit(nextArr));
  }

  const idx1 = arr.indexOf(v + 1);
  const idx2 = arr.indexOf(v + 2);

  if (idx1 !== -1 && idx2 !== -1) {
    const nextArr = [...arr];
    nextArr.splice(idx2, 1);
    nextArr.splice(idx1, 1);
    nextArr.splice(0, 1);
    minCost = Math.min(minCost, minWildcardsForSuit(nextArr));
  }
  if (idx1 !== -1) {
    const nextArr = [...arr];
    nextArr.splice(idx1, 1);
    nextArr.splice(0, 1);
    minCost = Math.min(minCost, 1 + minWildcardsForSuit(nextArr));
  }
  if (idx2 !== -1) {
    const nextArr = [...arr];
    nextArr.splice(idx2, 1);
    nextArr.splice(0, 1);
    minCost = Math.min(minCost, 1 + minWildcardsForSuit(nextArr));
  }

  suitWildcardCache.set(key, minCost);
  return minCost;
}

export function minWildcardsForZi(vals: number[]): number {
  if (vals.length === 0) return 0;
  const counts = new Map<number, number>();
  vals.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  let needed = 0;
  for (const c of counts.values()) {
    const rem = c % 3;
    if (rem === 1) needed += 2;
    else if (rem === 2) needed += 1;
  }
  return needed;
}

export function totalWildcardsNeeded(w: number[], ti: number[], to: number[], z: number[]): number {
  return minWildcardsForSuit(w) + minWildcardsForSuit(ti) + minWildcardsForSuit(to) + minWildcardsForZi(z);
}

export function checkHongzhongWinLocal(hand: Pick<MahjongTile, 'type' | 'value' | 'text'>[]): boolean {
  if (hand.length % 3 !== 2) return false;

  const hzCount = hand.filter((t) => (t.type === 'zi' && t.value === 5) || t.text === '红中').length;
  if (hzCount === 4) return true;

  const normalTiles = hand.filter((t) => !((t.type === 'zi' && t.value === 5) || t.text === '红中'));

  if (hand.length === 14) {
    const counts = new Map<string, number>();
    normalTiles.forEach((c) => counts.set(`${c.type}-${c.value}`, (counts.get(`${c.type}-${c.value}`) || 0) + 1));
    let neededForSingles = 0;
    for (const cnt of counts.values()) {
      neededForSingles += cnt % 2;
    }
    if (hzCount >= neededForSingles) {
      return true;
    }
  }

  const wan = normalTiles.filter((t) => t.type === 'wan').map((t) => t.value).sort((a, b) => a - b);
  const tiao = normalTiles.filter((t) => t.type === 'tiao').map((t) => t.value).sort((a, b) => a - b);
  const tong = normalTiles.filter((t) => t.type === 'tong').map((t) => t.value).sort((a, b) => a - b);
  const zi = normalTiles.filter((t) => t.type === 'zi').map((t) => t.value).sort((a, b) => a - b);

  if (hzCount >= 2) {
    if (totalWildcardsNeeded(wan, tiao, tong, zi) <= hzCount - 2) {
      return true;
    }
  }

  if (hzCount >= 1) {
    const tried = new Set<string>();
    for (const t of normalTiles) {
      const key = `${t.type}-${t.value}`;
      if (tried.has(key)) continue;
      tried.add(key);

      const testWan = [...wan];
      const testTiao = [...tiao];
      const testTong = [...tong];
      const testZi = [...zi];

      if (t.type === 'wan') testWan.splice(testWan.indexOf(t.value), 1);
      else if (t.type === 'tiao') testTiao.splice(testTiao.indexOf(t.value), 1);
      else if (t.type === 'tong') testTong.splice(testTong.indexOf(t.value), 1);
      else if (t.type === 'zi') testZi.splice(testZi.indexOf(t.value), 1);

      if (totalWildcardsNeeded(testWan, testTiao, testTong, testZi) <= hzCount - 1) {
        return true;
      }
    }
  }

  const countsByKind = new Map<string, { type: 'wan' | 'tiao' | 'tong' | 'zi'; value: number; count: number }>();
  normalTiles.forEach((t) => {
    const key = `${t.type}-${t.value}`;
    if (!countsByKind.has(key)) {
      countsByKind.set(key, { type: t.type, value: t.value, count: 0 });
    }
    countsByKind.get(key)!.count++;
  });

  for (const item of countsByKind.values()) {
    if (item.count >= 2) {
      const testWan = [...wan];
      const testTiao = [...tiao];
      const testTong = [...tong];
      const testZi = [...zi];

      if (item.type === 'wan') {
        testWan.splice(testWan.indexOf(item.value), 1);
        testWan.splice(testWan.indexOf(item.value), 1);
      } else if (item.type === 'tiao') {
        testTiao.splice(testTiao.indexOf(item.value), 1);
        testTiao.splice(testTiao.indexOf(item.value), 1);
      } else if (item.type === 'tong') {
        testTong.splice(testTong.indexOf(item.value), 1);
        testTong.splice(testTong.indexOf(item.value), 1);
      } else if (item.type === 'zi') {
        testZi.splice(testZi.indexOf(item.value), 1);
        testZi.splice(testZi.indexOf(item.value), 1);
      }

      if (totalWildcardsNeeded(testWan, testTiao, testTong, testZi) <= hzCount) {
        return true;
      }
    }
  }

  return false;
}

export interface MahjongAiContext {
  hongzhongMode: boolean;
  discards: MahjongTile[];
  meldedTiles: MahjongTile[][];
  oppMelds: MahjongTile[][][];
  wallCount: number;
}

const suitShapeCache = new Map<string, Array<[number, number]>>();

function addParetoState(states: Array<[number, number]>, m: number, t: number) {
  for (let i = 0; i < states.length; i++) {
    const [em, et] = states[i];
    if (em >= m && em + et >= m + t) return;
  }
  for (let i = states.length - 1; i >= 0; i--) {
    const [em, et] = states[i];
    if (m >= em && m + t >= em + et) {
      states.splice(i, 1);
    }
  }
  states.push([m, t]);
}

function evalSuitMeldTaatsu(counts: number[]): Array<[number, number]> {
  const key = counts.slice(1, 10).join('');
  const cached = suitShapeCache.get(key);
  if (cached) return cached;
  if (suitShapeCache.size > 6000) suitShapeCache.clear();

  const states: Array<[number, number]> = [[0, 0]];
  const dfs = (pos: number, m: number, t: number) => {
    while (pos <= 9 && counts[pos] === 0) pos++;
    if (pos > 9) {
      addParetoState(states, m, t);
      return;
    }

    // 1. Triplet (刻子)
    if (counts[pos] >= 3) {
      counts[pos] -= 3;
      dfs(pos, m + 1, t);
      counts[pos] += 3;
    }

    // 2. Sequence (顺子)
    if (pos <= 7 && counts[pos + 1] > 0 && counts[pos + 2] > 0) {
      counts[pos]--;
      counts[pos + 1]--;
      counts[pos + 2]--;
      dfs(pos, m + 1, t);
      counts[pos]++;
      counts[pos + 1]++;
      counts[pos + 2]++;
    }

    // 3. Pair as taatsu (对子搭子)
    if (counts[pos] >= 2) {
      counts[pos] -= 2;
      dfs(pos, m, t + 1);
      counts[pos] += 2;
    }

    // 4. Two-sided / edge taatsu (两面/边张搭子)
    if (pos <= 8 && counts[pos + 1] > 0) {
      counts[pos]--;
      counts[pos + 1]--;
      dfs(pos, m, t + 1);
      counts[pos]++;
      counts[pos + 1]++;
    }

    // 5. Gap taatsu (嵌张搭子)
    if (pos <= 7 && counts[pos + 2] > 0) {
      counts[pos]--;
      counts[pos + 2]--;
      dfs(pos, m, t + 1);
      counts[pos]++;
      counts[pos + 2]++;
    }

    // 6. Skip 1 isolated tile
    const prev = counts[pos];
    counts[pos] = prev - 1;
    dfs(pos, m, t);
    counts[pos] = prev;
  };

  dfs(1, 0, 0);
  suitShapeCache.set(key, states);
  return states;
}

function evalZiMeldTaatsu(counts: number[]): [number, number] {
  let m = 0;
  let t = 0;
  for (let v = 1; v <= 7; v++) {
    const c = counts[v];
    if (c >= 3) {
      m++;
      if (c >= 5) t++;
    } else if (c === 2) {
      t++;
    }
  }
  return [m, t];
}

function computeRegularShantenRaw(
  suitCounts: [number[], number[], number[], number[]],
  targetMelds: number
): number {
  const evalWithoutPair = (): number => {
    const s0 = evalSuitMeldTaatsu(suitCounts[0]);
    const s1 = evalSuitMeldTaatsu(suitCounts[1]);
    const s2 = evalSuitMeldTaatsu(suitCounts[2]);
    const [zm, zt] = evalZiMeldTaatsu(suitCounts[3]);

    let best = targetMelds * 2;
    for (const [m0, t0] of s0) {
      for (const [m1, t1] of s1) {
        for (const [m2, t2] of s2) {
          const totalM = Math.min(targetMelds, m0 + m1 + m2 + zm);
          const totalT = Math.min(targetMelds - totalM, t0 + t1 + t2 + zt);
          const s = targetMelds * 2 - totalM * 2 - totalT;
          if (s < best) best = s;
        }
      }
    }
    return best;
  };

  let bestShanten = evalWithoutPair();

  // Try selecting each existing pair as the eye (雀头)
  for (let typeIdx = 0; typeIdx < 4; typeIdx++) {
    const maxVal = typeIdx === 3 ? 7 : 9;
    for (let v = 1; v <= maxVal; v++) {
      if (suitCounts[typeIdx][v] >= 2) {
        suitCounts[typeIdx][v] -= 2;
        const s0 = evalSuitMeldTaatsu(suitCounts[0]);
        const s1 = evalSuitMeldTaatsu(suitCounts[1]);
        const s2 = evalSuitMeldTaatsu(suitCounts[2]);
        const [zm, zt] = evalZiMeldTaatsu(suitCounts[3]);

        for (const [m0, t0] of s0) {
          for (const [m1, t1] of s1) {
            for (const [m2, t2] of s2) {
              const totalM = Math.min(targetMelds, m0 + m1 + m2 + zm);
              const totalT = Math.min(targetMelds - totalM, t0 + t1 + t2 + zt);
              const s = targetMelds * 2 - totalM * 2 - totalT - 1;
              if (s < bestShanten) bestShanten = s;
            }
          }
        }
        suitCounts[typeIdx][v] += 2;
      }
    }
  }

  return bestShanten;
}

export function calculateMahjongShanten(
  hand: Pick<MahjongTile, 'type' | 'value' | 'text'>[],
  hongzhongMode: boolean,
  meldsCountOverride?: number
): { shanten: number; stdShanten: number; sevenPairsShanten: number } {
  const meldsCount =
    meldsCountOverride !== undefined ? meldsCountOverride : Math.max(0, 4 - Math.floor(hand.length / 3));
  const targetMelds = Math.max(0, 4 - meldsCount);

  if (hand.length % 3 === 2) {
    const isWin = hongzhongMode ? checkHongzhongWinLocal(hand) : checkMahjongWinLocal(hand);
    if (isWin) {
      return { shanten: -1, stdShanten: -1, sevenPairsShanten: -1 };
    }
  }

  const hzCount = hongzhongMode ? hand.filter((t) => (t.type === 'zi' && t.value === 5) || t.text === '红中').length : 0;
  if (hongzhongMode && hzCount >= 4) {
    return { shanten: -1, stdShanten: -1, sevenPairsShanten: -1 };
  }

  const suitCounts: [number[], number[], number[], number[]] = [
    new Array(10).fill(0),
    new Array(10).fill(0),
    new Array(10).fill(0),
    new Array(8).fill(0),
  ];

  let nonHzPairsForSeven = 0;
  const nonHzKindMap = new Map<string, number>();

  for (const t of hand) {
    if (hongzhongMode && ((t.type === 'zi' && t.value === 5) || t.text === '红中')) continue;
    if (t.type === 'wan') suitCounts[0][t.value]++;
    else if (t.type === 'tiao') suitCounts[1][t.value]++;
    else if (t.type === 'tong') suitCounts[2][t.value]++;
    else if (t.type === 'zi' && t.value >= 1 && t.value <= 7) suitCounts[3][t.value]++;

    const k = `${t.type}-${t.value}`;
    nonHzKindMap.set(k, (nonHzKindMap.get(k) || 0) + 1);
  }

  for (const cnt of nonHzKindMap.values()) {
    nonHzPairsForSeven += Math.floor(cnt / 2);
  }

  const rawStd = computeRegularShantenRaw(suitCounts, targetMelds);
  const minPossibleForSize = hand.length % 3 === 2 ? 0 : 0;
  const stdShanten = Math.max(minPossibleForSize, rawStd - hzCount);

  let sevenPairsShanten = 99;
  if (meldsCount === 0 && hand.length >= 13) {
    sevenPairsShanten = Math.max(0, 6 - nonHzPairsForSeven - hzCount);
  }

  return {
    shanten: Math.min(stdShanten, sevenPairsShanten),
    stdShanten,
    sevenPairsShanten,
  };
}

function buildVisibleCountsMap(ctx: Partial<MahjongAiContext>): Record<string, number> {
  const visibleCounts: Record<string, number> = {};
  (ctx.discards || []).forEach((t) => {
    const key = `${t.type}-${t.value}`;
    visibleCounts[key] = (visibleCounts[key] || 0) + 1;
  });
  (ctx.meldedTiles || []).forEach((meld) => {
    meld.forEach((t) => {
      const key = `${t.type}-${t.value}`;
      visibleCounts[key] = (visibleCounts[key] || 0) + 1;
    });
  });
  (ctx.oppMelds || []).forEach((playerMelds) => {
    playerMelds.forEach((meld) => {
      meld.forEach((t) => {
        const key = `${t.type}-${t.value}`;
        visibleCounts[key] = (visibleCounts[key] || 0) + 1;
      });
    });
  });
  return visibleCounts;
}

function evaluateHandUkeire(
  hand3k1: MahjongTile[],
  hongzhongMode: boolean,
  visibleCounts: Record<string, number>,
  meldsCount: number
): { shanten: number; ukeire: number; tingDoors: number; tingTiles: number; advancingDoors: number } {
  const { shanten } = calculateMahjongShanten(hand3k1, hongzhongMode, meldsCount);
  let ukeire = 0;
  let tingDoors = 0;
  let tingTiles = 0;
  let advancingDoors = 0;

  const inHandCounts: Record<string, number> = {};
  for (const t of hand3k1) {
    const k = `${t.type}-${t.value}`;
    inHandCounts[k] = (inHandCounts[k] || 0) + 1;
  }

  for (const kind of ALL_TILE_KINDS) {
    const key = `${kind.type}-${kind.value}`;
    const used = (visibleCounts[key] || 0) + (inHandCounts[key] || 0);
    const availableInWall = Math.max(0, 4 - used);
    if (availableInWall === 0) continue;

    if (shanten === 0) {
      const test14 = [...hand3k1, { id: 'test-u', type: kind.type, value: kind.value, text: kind.text, color: '' }];
      const canWin = hongzhongMode ? checkHongzhongWinLocal(test14) : checkMahjongWinLocal(test14);
      if (canWin) {
        tingDoors++;
        tingTiles += availableInWall;
        ukeire += availableInWall;
      }
    } else {
      // Quick relevance filter when no Hongzhong and shanten > 0 (unless pursuing 7-pairs)
      const isHzKind = hongzhongMode && kind.type === 'zi' && kind.value === 5;
      const hasConnection =
        isHzKind ||
        (inHandCounts[key] || 0) > 0 ||
        (kind.type !== 'zi' &&
          ((inHandCounts[`${kind.type}-${kind.value - 1}`] || 0) > 0 ||
            (inHandCounts[`${kind.type}-${kind.value + 1}`] || 0) > 0 ||
            (inHandCounts[`${kind.type}-${kind.value - 2}`] || 0) > 0 ||
            (inHandCounts[`${kind.type}-${kind.value + 2}`] || 0) > 0));
      if (!hasConnection) continue;

      const test14 = [...hand3k1, { id: 'test-u', type: kind.type, value: kind.value, text: kind.text, color: '' }];
      const nextRes = calculateMahjongShanten(test14, hongzhongMode, meldsCount);
      if (nextRes.shanten < shanten) {
        advancingDoors++;
        ukeire += availableInWall;
      }
    }
  }

  return { shanten, ukeire, tingDoors, tingTiles, advancingDoors };
}

export function shouldSmartPengHand(
  hand: MahjongTile[],
  tile: MahjongTile,
  hongzhongMode: boolean,
  ctx?: Partial<MahjongAiContext>
): boolean {
  if (!tile) return false;
  if (hongzhongMode && isHongzhong(tile)) return false;

  const matches = hand.filter((c) => c.type === tile.type && c.value === tile.value);
  if (matches.length < 2) return false;

  const meldsCount =
    ctx?.meldedTiles !== undefined ? ctx.meldedTiles.length : Math.max(0, 4 - Math.floor(hand.length / 3));
  const visibleCounts = ctx ? buildVisibleCountsMap(ctx) : {};

  // Evaluate hand BEFORE Peng
  const beforeInfo = evaluateHandUkeire(hand, hongzhongMode, visibleCounts, meldsCount);
  const beforeShantenInfo = calculateMahjongShanten(hand, hongzhongMode, meldsCount);

  // Only preserve 7-pairs if NO melds yet and already 1-shanten or Tenpai for 7-pairs
  const pursuingSevenPairs = meldsCount === 0 && beforeShantenInfo.sevenPairsShanten <= 1;

  // Simulate Peng: remove 2 copies and test every post-Peng discard
  const remainingHand = [...hand];
  let removed = 0;
  for (let i = remainingHand.length - 1; i >= 0 && removed < 2; i--) {
    if (remainingHand[i].type === tile.type && remainingHand[i].value === tile.value) {
      remainingHand.splice(i, 1);
      removed++;
    }
  }
  if (remainingHand.length === 0) return false;

  // Add the Peng tile to visible counts accurately for post-Peng ukeire calculation
  const postVisible = { ...visibleCounts };
  const tileKey = `${tile.type}-${tile.value}`;
  postVisible[tileKey] = Math.min(4, (postVisible[tileKey] || 0) + 3);

  let bestAfterShanten = 99;
  let bestAfterUkeire = -1;
  const seenDiscardKinds = new Set<string>();

  for (let i = 0; i < remainingHand.length; i++) {
    const cand = remainingHand[i];
    if (hongzhongMode && isHongzhong(cand)) continue;
    const ck = `${cand.type}-${cand.value}`;
    if (seenDiscardKinds.has(ck)) continue;
    seenDiscardKinds.add(ck);

    const nextHand = remainingHand.filter((_, idx) => idx !== i);
    const afterInfo = evaluateHandUkeire(nextHand, hongzhongMode, postVisible, meldsCount + 1);
    if (
      afterInfo.shanten < bestAfterShanten ||
      (afterInfo.shanten === bestAfterShanten && afterInfo.ukeire > bestAfterUkeire)
    ) {
      bestAfterShanten = afterInfo.shanten;
      bestAfterUkeire = afterInfo.ukeire;
    }
  }

  // If 7-pairs is closer or equal to post-Peng Tenpai/1-shanten and we are 0-shanten 7-pairs, keep 7-pairs!
  if (pursuingSevenPairs && beforeShantenInfo.sevenPairsShanten <= bestAfterShanten && bestAfterShanten > 0) {
    return false;
  }

  // 1. Enters Tenpai (听牌)!
  if (bestAfterShanten === 0) {
    if (beforeInfo.shanten > 0) return bestAfterUkeire > 0 || bestAfterShanten < beforeInfo.shanten;
    // Already Tenpai: Peng only if it increases remaining winning tiles
    return bestAfterUkeire > beforeInfo.ukeire;
  }

  // 2. Strictly reduces Shanten (向听数前进)!
  if (bestAfterShanten < beforeInfo.shanten) {
    // If jumping from 7-pairs 1-shanten with > 5 live waits vs weak 1-shanten after peng
    if (pursuingSevenPairs && beforeShantenInfo.sevenPairsShanten === 1 && bestAfterUkeire < 4) {
      return false;
    }
    return true;
  }

  // 3. Same Shanten: evaluate strategic speed value
  if (bestAfterShanten === beforeInfo.shanten) {
    // Wind / Dragon triplets cannot be formed as sequences — always lock them in when shanten doesn't worsen
    if (tile.type === 'zi') {
      return true;
    }
    // If already open hand (1+ melds), prioritize speed unless it severely cripples waits
    if (meldsCount >= 1 && bestAfterUkeire >= Math.max(2, Math.floor(beforeInfo.ukeire * 0.65))) {
      return true;
    }
    // Terminal pairs (1/9) or pure duplicate triplet lock-ins
    if ((tile.value === 1 || tile.value === 9) && bestAfterUkeire >= Math.max(2, Math.floor(beforeInfo.ukeire * 0.75))) {
      return true;
    }
    // Strict ukeire gain
    if (bestAfterUkeire > beforeInfo.ukeire) {
      return true;
    }
    // Mid-game 1-shanten/2-shanten acceleration when tile isn't deeply embedded in two sequences
    if (bestAfterShanten <= 2 && bestAfterUkeire >= beforeInfo.ukeire - 2) {
      const suitVals = hand.filter((c) => c.type === tile.type).map((c) => c.value);
      const v = tile.value;
      const isDoubleConnected =
        (suitVals.includes(v - 1) && suitVals.includes(v + 1)) ||
        (suitVals.includes(v - 2) && suitVals.includes(v - 1) && suitVals.includes(v + 1));
      if (!isDoubleConnected) return true;
    }
  }

  return false;
}

export function shouldSmartKongHand(
  hand: MahjongTile[],
  tile: MahjongTile,
  gangType: 'ming' | 'an' | 'bu',
  hongzhongMode: boolean,
  ctx?: Partial<MahjongAiContext>
): boolean {
  if (!tile) return false;
  if (hongzhongMode && isHongzhong(tile)) return false;
  if (ctx?.wallCount !== undefined && ctx.wallCount <= 0) return false;

  const meldsCount =
    ctx?.meldedTiles !== undefined ? ctx.meldedTiles.length : Math.max(0, 4 - Math.floor(hand.length / 3));

  if (gangType === 'ming') {
    const matches = hand.filter((c) => c.type === tile.type && c.value === tile.value);
    if (matches.length < 3 || hand.length % 3 !== 1) return false;
    const before = calculateMahjongShanten(hand, hongzhongMode, meldsCount);
    const rem = [...hand];
    let removed = 0;
    for (let i = rem.length - 1; i >= 0 && removed < 3; i--) {
      if (rem[i].type === tile.type && rem[i].value === tile.value) {
        rem.splice(i, 1);
        removed++;
      }
    }
    const after = calculateMahjongShanten(rem, hongzhongMode, meldsCount + 1);
    // Do not break a clean 0-shanten multi-wait hand if Kong drops it to 2+ shanten
    if (before.shanten === 0 && after.shanten >= 2) return false;
    return true;
  }

  if (gangType === 'an') {
    const matches = hand.filter((c) => c.type === tile.type && c.value === tile.value);
    if (matches.length < 4 || hand.length % 3 !== 2) return false;
    // Compute best shanten before An-Gang (across discards)
    let bestBefore = 99;
    for (let i = 0; i < hand.length; i++) {
      const sub = hand.filter((_, idx) => idx !== i);
      const res = calculateMahjongShanten(sub, hongzhongMode, meldsCount);
      if (res.shanten < bestBefore) bestBefore = res.shanten;
    }
    const rem = hand.filter((c) => !(c.type === tile.type && c.value === tile.value));
    const after = calculateMahjongShanten(rem, hongzhongMode, meldsCount + 1);
    if (bestBefore === 0 && after.shanten >= 2) return false;
    return true;
  }

  // Bu-Gang (补杠): almost always +30 points + free supplemental draw
  if (gangType === 'bu') {
    const idx = hand.findIndex((c) => c.type === tile.type && c.value === tile.value);
    if (idx < 0 || hand.length % 3 !== 2) return false;
    let bestBefore = 99;
    for (let i = 0; i < hand.length; i++) {
      const sub = hand.filter((_, j) => j !== i);
      const res = calculateMahjongShanten(sub, hongzhongMode, meldsCount);
      if (res.shanten < bestBefore) bestBefore = res.shanten;
    }
    const rem = hand.filter((_, j) => j !== idx);
    const after = calculateMahjongShanten(rem, hongzhongMode, meldsCount);
    if (bestBefore === 0 && after.shanten >= 2) return false;
    return true;
  }

  return false;
}

export function findSmartSelfKong(
  hand: MahjongTile[],
  melds: MahjongTile[][],
  hongzhongMode: boolean,
  ctx?: Partial<MahjongAiContext>
): { gangType: 'an' | 'bu'; tile: MahjongTile } | null {
  if (hand.length % 3 !== 2) return null;
  if (ctx?.wallCount !== undefined && ctx.wallCount <= 0) return null;

  // 1. Check An-Gang candidates
  const counts = new Map<string, MahjongTile[]>();
  for (const c of hand) {
    if (hongzhongMode && isHongzhong(c)) continue;
    const k = `${c.type}-${c.value}`;
    if (!counts.has(k)) counts.set(k, []);
    counts.get(k)!.push(c);
  }
  for (const tiles of counts.values()) {
    if (tiles.length === 4 && shouldSmartKongHand(hand, tiles[0], 'an', hongzhongMode, ctx)) {
      return { gangType: 'an', tile: tiles[0] };
    }
  }

  // 2. Check Bu-Gang candidates
  const normalizedMelds = normalizeServerMelds(melds as any[]);
  for (const meld of normalizedMelds) {
    if (meld.length === 3 && meld[0] && meld[0].type === meld[1]?.type && meld[0].value === meld[1]?.value) {
      const match = hand.find((c) => c.type === meld[0].type && c.value === meld[0].value);
      if (match && shouldSmartKongHand(hand, match, 'bu', hongzhongMode, ctx)) {
        return { gangType: 'bu', tile: match };
      }
    }
  }

  return null;
}

export function scoreMahjongHand(
  tiles: MahjongTile[],
  ctx: Pick<MahjongAiContext, 'hongzhongMode' | 'discards' | 'meldedTiles'>,
  evaluateTing = false
): number {
  if (!tiles || tiles.length === 0) return 0;

  const isWin = ctx.hongzhongMode ? checkHongzhongWinLocal(tiles) : checkMahjongWinLocal(tiles);
  if (isWin) return 100000;

  const meldsCount = ctx.meldedTiles?.length ?? Math.max(0, 4 - Math.floor(tiles.length / 3));
  const shantenInfo = calculateMahjongShanten(tiles, ctx.hongzhongMode, meldsCount);
  let totalScore = (8 - shantenInfo.shanten) * 6000;

  const groups: Record<string, number[]> = { wan: [], tiao: [], tong: [], zi: [] };
  tiles.forEach((t) => groups[t.type].push(t.value));

  if (ctx.hongzhongMode) {
    const hzCount = tiles.filter(isHongzhong).length;
    totalScore += hzCount * 2200;
  }

  for (const type in groups) {
    const vals = groups[type];
    if (vals.length === 0) continue;

    const counts: number[] = new Array(10).fill(0);
    vals.forEach((v) => {
      if (v >= 1 && v <= 9) counts[v]++;
    });

    if (type === 'zi') {
      for (let v = 1; v <= 7; v++) {
        const c = counts[v];
        if (ctx.hongzhongMode && v === 5) continue;
        if (c >= 3) totalScore += 600;
        else if (c === 2) totalScore += 260;
        else if (c === 1) totalScore -= 280;
      }
    } else {
      const cMap = [...counts];
      for (let v = 1; v <= 9; v++) {
        if (cMap[v] >= 3) {
          totalScore += 680;
          cMap[v] -= 3;
        }
      }
      for (let v = 1; v <= 7; v++) {
        while (cMap[v] > 0 && cMap[v + 1] > 0 && cMap[v + 2] > 0) {
          totalScore += 650;
          cMap[v]--;
          cMap[v + 1]--;
          cMap[v + 2]--;
        }
      }
      for (let v = 1; v <= 9; v++) {
        if (cMap[v] >= 2) {
          totalScore += 280;
          cMap[v] -= 2;
        }
      }
      for (let v = 1; v <= 8; v++) {
        if (cMap[v] > 0 && cMap[v + 1] > 0) {
          // Two-sided ryanmen (23..78) is strictly better than edge 12/89
          const isEdge = v === 1 || v === 8;
          totalScore += isEdge ? 140 : 250;
          cMap[v]--;
          cMap[v + 1]--;
        }
      }
      for (let v = 1; v <= 7; v++) {
        if (cMap[v] > 0 && cMap[v + 2] > 0) {
          totalScore += 150;
          cMap[v]--;
          cMap[v + 2]--;
        }
      }
      for (let v = 1; v <= 9; v++) {
        if (cMap[v] > 0) {
          if (v === 1 || v === 9) totalScore -= 180;
          else if (v === 2 || v === 8) totalScore -= 90;
          else totalScore -= 40;
        }
      }
    }
  }

  if (evaluateTing) {
    const vis = buildVisibleCountsMap(ctx);
    const uRes = evaluateHandUkeire(tiles, ctx.hongzhongMode, vis, meldsCount);
    if (uRes.tingDoors > 0) {
      totalScore += 20000 + uRes.tingDoors * 1500 + uRes.tingTiles * 300;
    } else {
      totalScore += uRes.ukeire * 180;
    }
  }

  return totalScore;
}

export function findSmartBestDiscardIdx(hand: MahjongTile[], ctx: MahjongAiContext): number {
  if (hand.length <= 1) return 0;

  const nonHzIndices = hand
    .map((t, idx) => ({ t, idx }))
    .filter((item) => !(ctx.hongzhongMode && isHongzhong(item.t)));
  const candidateIndices = nonHzIndices.length > 0 ? nonHzIndices.map((item) => item.idx) : hand.map((_, idx) => idx);

  const uniqueCandidateIndices: number[] = [];
  const seenKinds = new Set<string>();
  for (const idx of candidateIndices) {
    const t = hand[idx];
    const key = `${t.type}-${t.value}`;
    if (!seenKinds.has(key)) {
      seenKinds.add(key);
      uniqueCandidateIndices.push(idx);
    }
  }
  const evalIndices = uniqueCandidateIndices.length > 0 ? uniqueCandidateIndices : candidateIndices;

  const visibleCounts = buildVisibleCountsMap(ctx);
  const meldsCount = ctx.meldedTiles?.length ?? Math.max(0, 4 - Math.floor(hand.length / 3));
  const oppMaxMelds = Math.max(0, ...(ctx.oppMelds || []).map((m) => m.length));
  const isDangerPhase = ctx.wallCount < 28 || oppMaxMelds >= 2;

  let bestIndex = evalIndices[0];
  let maxTotalScore = -999999999;

  for (const i of evalIndices) {
    const tile = hand[i];
    const hand13 = hand.filter((_, idx) => idx !== i);

    const uInfo = evaluateHandUkeire(hand13, ctx.hongzhongMode, visibleCounts, meldsCount);
    const shapeScore = scoreMahjongHand(hand13, ctx, false);

    // Primary: Minimize Shanten (向听数)
    // Secondary: Maximize effective remaining wall tiles (有效进张 ukeire + 听牌数)
    const shantenScore = (8 - uInfo.shanten) * 120000;
    const ukeireScore =
      uInfo.shanten === 0
        ? 45000 + uInfo.tingTiles * 3500 + uInfo.tingDoors * 2200
        : uInfo.ukeire * 1400 + uInfo.advancingDoors * 400;

    let discardUrgencyBonus = 0;
    const sameTileCountInHand = hand.filter((t) => t.type === tile.type && t.value === tile.value).length;
    const tileKey = `${tile.type}-${tile.value}`;
    const sameTileVisible = visibleCounts[tileKey] || 0;

    if (tile.type === 'zi') {
      if (sameTileCountInHand === 1) {
        discardUrgencyBonus += sameTileVisible >= 2 ? 1400 : 850;
      } else if (sameTileCountInHand === 2) {
        discardUrgencyBonus -= 400;
      }
    } else if (sameTileCountInHand === 1) {
      if (tile.value === 1 || tile.value === 9) {
        const hasAdj = hand.some((t) => t.type === tile.type && Math.abs(t.value - tile.value) === 1);
        const hasGap = hand.some((t) => t.type === tile.type && Math.abs(t.value - tile.value) === 2);
        if (!hasAdj && !hasGap) discardUrgencyBonus += 550;
        else if (!hasAdj) discardUrgencyBonus += 250;
      } else if (tile.value === 2 || tile.value === 8) {
        const hasNeighbor = hand.some((t) => t.type === tile.type && Math.abs(t.value - tile.value) <= 1 && t !== tile);
        if (!hasNeighbor) discardUrgencyBonus += 280;
      }
    }

    // Slight Yi-Wu-Jiu Ma preservation tie-breaker in Hongzhong mode
    if (ctx.hongzhongMode && isYiWuJiuMaTile(tile) && uInfo.shanten >= 1) {
      discardUrgencyBonus -= 30;
    }

    // Defense / Safety awareness in late wall or vs melded opponents
    let defenseBonus = 0;
    if (isDangerPhase) {
      const seenCount = sameTileVisible + sameTileCountInHand;
      const isGenbutsu = (ctx.discards || []).some((d) => d.type === tile.type && d.value === tile.value);
      if (isGenbutsu) {
        defenseBonus += uInfo.shanten >= 2 ? 2400 : 900;
      } else if (seenCount >= 3) {
        defenseBonus += uInfo.shanten >= 2 ? 1600 : 600;
      } else if (tile.type !== 'zi' && tile.value >= 4 && tile.value <= 6 && sameTileVisible === 0) {
        defenseBonus -= uInfo.shanten >= 2 ? 1800 : 500;
      }
    }

    const totalEvaluation = shantenScore + ukeireScore + shapeScore * 0.25 + discardUrgencyBonus + defenseBonus;

    if (totalEvaluation > maxTotalScore) {
      maxTotalScore = totalEvaluation;
      bestIndex = i;
    }
  }

  return bestIndex;
}
