import type { GuardLevel, LiveUser, Medal } from '../types';

/**
 * 演示模式：不连接 B 站，用一批真实抓取到的原始消息 + 合成消息回放，
 * 方便在没有网络 / 没有开播房间时预览界面，也用于验证解析逻辑。
 */

export interface DemoHandlers {
  emit: (cmd: string, payload: unknown) => void;
}

interface DemoUser extends LiveUser {
  medal?: Medal;
  guardLevel: GuardLevel;
}

const USERS: Array<{ name: string; uid: string; face?: string; guard?: GuardLevel; medal?: { name: string; level: number } }> = [
  {
    name: '桃桃乌龙',
    uid: '90101',
    face: 'https://i1.hdslb.com/bfs/face/36f1da7cf4c99f0740332a4a0a9b4aef6b303aa1.jpg',
    medal: { name: '清鸽', level: 21 },
  },
  {
    name: '星野あき',
    uid: '90102',
    face: 'https://i1.hdslb.com/bfs/face/d14708e9d10660de6f1a1a48b3be80a15cfad348.jpg',
    guard: 3,
    medal: { name: '清鸽', level: 28 },
  },
  { name: '咸鱼翻身', uid: '90103', face: 'https://i2.hdslb.com/bfs/face/e1b90070c6a3ec7e5ee0248b8124b39488e741ee.jpg' },
  { name: '夜航星', uid: '90104', face: 'https://i0.hdslb.com/bfs/face/8f6a614a48a3813d90da7a11894ae56a59396fcd.jpg', medal: { name: '夏天歪', level: 12 } },
  { name: '阿绫的猫', uid: '90105', face: 'https://i1.hdslb.com/bfs/face/24e3bfba063cbcb995a6a28fd05cf3c49b7943b0.jpg' },
  {
    name: '梦里什么都有',
    uid: '90106',
    face: 'https://i2.hdslb.com/bfs/face/1ca9529918655201b1aaf318701c65db20678139.jpg',
    guard: 2,
    medal: { name: '清鸽', level: 30 },
  },
  { name: '一只清鸽', uid: '90107', face: 'https://i1.hdslb.com/bfs/face/6935bff63958e2500ef4129db2b6998d91affafa.jpg', medal: { name: '清鸽', level: 9 } },
  { name: '冷面笑匠', uid: '90108' },
  { name: '不想上班', uid: '90109' },
  {
    name: '海边的契约者',
    uid: '90110',
    face: 'https://i1.hdslb.com/bfs/face/8583fde94f2256e498636303e39e366408972557.jpg',
    medal: { name: '清鸽', level: 16 },
  },
];

const TEXTS = [
  '这首也太好听了吧！',
  '主播今天状态好好',
  '前排围观！',
  '2333333',
  '这波操作可以',
  '声音好治愈，晚安',
  '学到了学到了',
  '哈哈哈哈哈',
  '来晚了还有位置吗',
  '弹幕护体',
  '打卡下班',
  '下次一定',
  '泪目了',
  '好耶',
  '666666',
  '求个 BGM 名字',
  '这个翻唱我可以听一整晚',
  '把氛围感拉满了',
];

const GIFTS = [
  { name: '辣条', price: 100, coinType: 'silver' as const },
  { name: '小心心', price: 0, coinType: 'silver' as const },
  { name: '小花花', price: 1000, coinType: 'gold' as const },
  { name: '牛哇牛哇', price: 1000, coinType: 'gold' as const },
  { name: '干杯', price: 2000, coinType: 'gold' as const },
  { name: '小电视飞船', price: 124500, coinType: 'gold' as const },
];

const SUPER_CHATS = [
  { price: 30, text: '这个作品太喜欢了，支持一下！' },
  { price: 50, text: '主播的歌单能分享一下吗？' },
  { price: 100, text: '第一次上舰，请多关照～' },
];

/** 从 B 站真实抓取的 SEND_GIFT_V2（protobuf）示例 */
const GIFT_V2_PB =
  'CODN3r0EEhjpnZLls7DnmoTlpKfogqXpsbzoib7mi4kaSmh0dHBzOi8vaTIuaGRzbGIuY29tL2Jmcy9mYWNlL2Q5NGFkNDg5ZmQzMzk5NDhmMzM0MDMzODdiZDk1MzUyYTdlY2U1ZTIuanBnQgBSkgUIvPMBEg/nsonkuJ3lm6Lnga/niYwYASABKGQwZDhkQgRnb2xkShM0ODM2ODY2MjYwNzIzNTkxMTY4UOznwdcGWAFiPWJhdGNoOmdpZnQ6Y29tYm9faWQ6MTIwMzIxODE0NDo4NDEzMDM1NjozMTE2NDoxNzk0MTQzMjEyLjIyNzloCnBkeAWFAQAAgD+IAQGSAQbmipXlloLAAfX+nxLqAQ4KB+Wkj+WkqXkQtPSOKIoC1AEItPSOKBLMAQoH5aSP5aSpeRJKaHR0cHM6Ly9pMC5oZHNsYi5jb20vYmZzL2ZhY2UvMjEzOWJhNDBmMzNhNTk3NzY3NWUyMDlhNjY4OTZjNGMzZmUzZWViNS5qcGcyVQoH5aSP5aSpeRJKaHR0cHM6Ly9pMC5oZHNsYi5jb20vYmZzL2ZhY2UvMjEzOWJhNDBmMzNhNTk3NzY3NWUyMDlhNjY4OTZjNGMzZmUzZWViNS5qcGc6HggBEhpiaWxpYmlsaSDnn6XlkI3muLjmiI9VUOS4u5ICBwiM4NcCEAGaAuUBCkpodHRwczovL3MxLmhkc2xiLmNvbS9iZnMvbGl2ZS9lMDUxZGZkNDU1NzY3OGY4ZWRjYWM0OTkzZWQwMGEwOTM1Y2JkOWNjLnBuZxJLaHR0cHM6Ly9pMC5oZHNsYi5jb20vYmZzL2xpdmUvMzJiNzk5MTIwZTE2MTRmYTYyNzViNmQxNWRhN2E1MmIyMWRkMDE5ZC53ZWJwKkpodHRwczovL2kwLmhkc2xiLmNvbS9iZnMvbGl2ZS84MTZmOGI3YWEyMTMyODg4ZmNlOTI4Y2RmYjE3YjljZjIxY2MwODIzLmdpZqoCFAgBEgcI9bfwAhACEgcIjODXAhABWAFqAggcescCCODN3r0EEtsBChjpnZLls7DnmoTlpKfogqXpsbzoib7mi4kSSmh0dHBzOi8vaTIuaGRzbGIuY29tL2Jmcy9mYWNlL2Q5NGFkNDg5ZmQzMzk5NDhmMzM0MDMzODdiZDk1MzUyYTdlY2U1ZTIuanBnMmYKGOmdkuWzsOeahOWkp+iCpemxvOiJvuaLiRJKaHR0cHM6Ly9pMi5oZHNsYi5jb20vYmZzL2ZhY2UvZDk0YWQ0ODlmZDMzOTk0OGYzMzQwMzM4N2JkOTUzNTJhN2VjZTVlMi5qcGc6CyD///////////8BGmEKCeWkj+WkqeatqhAFGMCBgwYgwIGDBijAgYMGMJ739QJQtPSOKGAoegkjOTE5Mjk4Q0OCAQkjOTE5Mjk4Q0OKAQkjOTE5Mjk4Q0OSAQcjRkZGRkZGmgEJIzkxOTI5OEU2';

/** 从 B 站真实抓取的 INTERACT_WORD_V2（protobuf）示例 */
const INTERACT_V2_PB =
  'CJ/hrqgHEg/lkqrlk57lkqrlmJvlk54iAgMBKAEw9PrwATjr58HXBkChhOvfmzRKMAi09I4oEBQaCeWkj+WkqeatqiCkup4GKKS6ngYwpLqeBjikup4GQAFg9PrwAWiED2IAeIPjgc7n94TzGJoBALIB1QEIn+GuqAcSXQoP5ZKq5ZOe5ZKq5Zib5ZOeEkpodHRwczovL2kxLmhkc2xiLmNvbS9iZnMvZmFjZS8zNmYxZGE3Y2Y0Yzk5ZjA3NDAzMzJhNGEwYTliNGFlZjZiMzAzYWExLmpwZxpoCgnlpI/lpKnmraoQFBikup4GIKS6ngYopLqeBjCkup4GOM6PAkgBULT0jihghA96CSNDNzcwQTQ5OYIBCSNDNzcwQTQ5OYoBCSNDNzcwQTQ5OZIBByNGRkZGRkaaAQkjQzc3MEE0RTYiAggCMgC6AQDCAQA=';

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomUser(): DemoUser {
  const raw = pick(USERS);
  return {
    uid: raw.uid,
    name: raw.name,
    face: raw.face,
    guardLevel: raw.guard ?? 0,
    medal: raw.medal
      ? { name: raw.medal.name, level: raw.medal.level, color: '#f1a0b8', guardLevel: raw.guard ?? 0 }
      : undefined,
  };
}

function danmakuPayload(user: DemoUser, text: string, color = 0xffffff) {
  const now = Date.now();
  const extra = {
    content: text,
    color,
    mode: 1,
    user: {
      uid: user.uid,
      base: { name: user.name, face: user.face },
      medal: user.medal
        ? { name: user.medal.name, level: user.medal.level, color: 12632256, v2_medal_color_text: user.medal.color }
        : null,
      guard: user.guardLevel ? { level: user.guardLevel } : null,
    },
  };

  const meta: unknown[] = [
    0,
    1,
    25,
    color,
    now,
    Math.floor(now / 1000),
    0,
    'demo',
    0,
    0,
    0,
    '',
    0,
    '{}',
    '{}',
    { extra: JSON.stringify(extra) },
  ];

  return {
    cmd: 'DANMU_MSG',
    info: [meta, text, [Number(user.uid), user.name, 0, 0, 0, 10000, 1, '']],
  };
}

export function startDemoStream(handlers: DemoHandlers): () => void {
  let stopped = false;
  const timers = new Set<number>();

  const later = (delay: number, task: () => void) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      if (!stopped) task();
    }, delay);
    timers.add(id);
  };

  let popularity = 486_320;
  let watched = 128_640;
  let likes = 8_240_000;
  let fans = 212_480;
  let onlineRank = 1_286;
  let richIndex = 0;

  const emitStats = () => {
    popularity += 800 + Math.floor(Math.random() * 1600);
    watched += 60 + Math.floor(Math.random() * 120);
    likes += 500 + Math.floor(Math.random() * 2400);
    fans += Math.random() > 0.8 ? 1 : 0;
    onlineRank = Math.min(9999, onlineRank + Math.floor(Math.random() * 8));

    handlers.emit('POPULARITY_CHANGE', { cmd: 'POPULARITY_CHANGE', data: { popularity, popularity_text: `${popularity}人气` } });
    handlers.emit('WATCHED_CHANGE', { cmd: 'WATCHED_CHANGE', data: { num: watched } });
    handlers.emit('LIKE_INFO_V3_UPDATE', { cmd: 'LIKE_INFO_V3_UPDATE', data: { click_count: likes } });
    handlers.emit('ROOM_REAL_TIME_MESSAGE_UPDATE', { cmd: 'ROOM_REAL_TIME_MESSAGE_UPDATE', data: { fans } });
    handlers.emit('ONLINE_RANK_COUNT', { cmd: 'ONLINE_RANK_COUNT', data: { count: onlineRank } });
  };

  const emitGift = () => {
    if (Math.random() < 0.25) {
      handlers.emit('SEND_GIFT_V2', { cmd: 'SEND_GIFT_V2', data: { pb: GIFT_V2_PB } });
      return;
    }

    const user = randomUser();
    const gift = pick(GIFTS);
    const num = gift.price >= 1000 ? 1 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 3);
    const combo = Math.random() < 0.4;

    handlers.emit('SEND_GIFT', {
      cmd: 'SEND_GIFT',
      data: {
        uid: Number(user.uid),
        uname: user.name,
        face: user.face,
        giftName: gift.name,
        giftId: 30000 + Math.floor(Math.random() * 1000),
        num,
        price: gift.price,
        coin_type: gift.coinType,
        total_coin: gift.price * num,
        batch_combo_id: combo ? `batch:demo:${Date.now()}` : '',
        batch_combo_num: num,
        combo_total_coin: gift.price * num,
        action: '投喂',
        guard_level: user.guardLevel,
        medal_info: user.medal
          ? { medal_name: user.medal.name, medal_level: user.medal.level, guard_level: user.guardLevel }
          : null,
      },
    });
  };

  const emitInteract = () => {
    if (Math.random() < 0.5) {
      handlers.emit('INTERACT_WORD_V2', { cmd: 'INTERACT_WORD_V2', data: { pb: INTERACT_V2_PB } });
      return;
    }
    const user = randomUser();
    handlers.emit('INTERACT_WORD', {
      cmd: 'INTERACT_WORD',
      data: {
        uid: Number(user.uid),
        uname: user.name,
        msg_type: Math.random() < 0.75 ? 1 : 2,
        guard_level: user.guardLevel,
        fans_medal: user.medal ? { medal_name: user.medal.name, medal_level: user.medal.level } : null,
      },
    });
  };

  const emitRichEvent = () => {
    richIndex += 1;

    if (richIndex % 4 === 1) {
      const user = randomUser();
      handlers.emit('ENTRY_EFFECT', {
        cmd: 'ENTRY_EFFECT',
        data: {
          uid: Number(user.uid),
          copy_writing: `<%${user.name}%> 来了`,
          uinfo: {
            uid: Number(user.uid),
            base: { name: user.name, face: user.face },
            guard: { level: 3 },
            medal: { name: '清鸽', level: 28, color: 12632256 },
          },
        },
      });
      return;
    }

    if (richIndex % 4 === 2) {
      const user = randomUser();
      handlers.emit('GUARD_BUY', {
        cmd: 'GUARD_BUY',
        data: {
          uid: Number(user.uid),
          username: user.name,
          guard_level: pick([3, 3, 3, 2, 1]),
          num: 1,
          price: 198000,
          gift_name: '舰长',
        },
      });
      return;
    }

    const sc = pick(SUPER_CHATS);
    const user = randomUser();
    handlers.emit('SUPER_CHAT_MESSAGE', {
      cmd: 'SUPER_CHAT_MESSAGE',
      data: {
        price: sc.price,
        message: sc.text,
        background_price_color: '#f0a45b',
        user_info: { uid: Number(user.uid), uname: user.name, guard_level: user.guardLevel },
        medal_info: user.medal ? { medal_name: user.medal.name, medal_level: user.medal.level } : null,
      },
    });
  };

  const step = () => {
    if (stopped) return;
    const roll = Math.random();
    if (roll < 0.58) {
      const color = Math.random() < 0.18 ? pick([0xff7299, 0x00aeec, 0xffd54a, 0x9d7bff]) : 0xffffff;
      handlers.emit('DANMU_MSG', danmakuPayload(randomUser(), pick(TEXTS), color));
    } else if (roll < 0.78) {
      emitGift();
    } else if (roll < 0.92) {
      emitInteract();
    } else if (roll < 0.96) {
      const user = randomUser();
      handlers.emit('LIKE_INFO_V3_CLICK', {
        cmd: 'LIKE_INFO_V3_CLICK',
        data: { uid: Number(user.uid), uname: user.name, like_text: '为主播点赞了' },
      });
    } else {
      emitRichEvent();
    }
    later(320 + Math.random() * 980, step);
  };

  handlers.emit('LIVE', { cmd: 'LIVE', data: { roomid: 3947892 } });
  emitStats();
  later(420, step);

  const statsTimer = window.setInterval(() => {
    if (!stopped) emitStats();
  }, 3600);
  timers.add(statsTimer);

  return () => {
    stopped = true;
    for (const id of timers) window.clearTimeout(id);
  };
}
