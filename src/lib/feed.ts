import type { FeedEvent, GiftEvent, GiftRank } from '../types';

/**
 * 把新消息合并进列表：
 * - 同一连击（comboId）的礼物在原位置累加，避免刷屏；
 * - 超出上限时丢弃最旧的消息。
 */
export function appendEvents(previous: FeedEvent[], incoming: FeedEvent[], cap: number): FeedEvent[] {
  if (incoming.length === 0) return previous;

  const list = previous.slice();
  const combos = new Map<string, number>();

  for (let i = list.length - 1; i >= 0; i -= 1) {
    const event = list[i];
    if (event.kind === 'gift' && event.comboId && !combos.has(event.comboId)) {
      combos.set(event.comboId, i);
    }
  }

  for (const event of incoming) {
    if (event.kind === 'gift' && event.comboId) {
      const index = combos.get(event.comboId);
      if (index !== undefined) {
        const target = list[index] as GiftEvent;
        list[index] = {
          ...target,
          num: event.num,
          comboNum: Math.max(event.comboNum ?? event.num, target.comboNum ?? target.num),
          totalCoin: event.totalCoin,
          ts: event.ts,
        };
        continue;
      }
    }

    list.push(event);
    if (event.kind === 'gift' && event.comboId) {
      combos.set(event.comboId, list.length - 1);
    }
  }

  return list.length > cap ? list.slice(list.length - cap) : list;
}

export function rankGifts(map: Map<string, GiftRank>): GiftRank[] {
  return [...map.values()]
    .sort((a, b) => b.gold - a.gold || b.silver - a.silver || b.count - a.count)
    .slice(0, 10);
}

export function totalGoldOfRanks(ranks: GiftRank[]): number {
  return ranks.reduce((sum, rank) => sum + rank.gold, 0);
}
