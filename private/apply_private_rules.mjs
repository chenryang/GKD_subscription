import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.argv[2] ?? process.cwd());

const privateRules = [
  {
    file: 'src/apps/com.xingin.xhs.ts',
    activityId: 'com.xingin.matrix.detail.activity.DetailFeedActivity',
    buildGroup: (key) => `    {
      key: ${key},
      name: '功能类-自动退出竖屏模式',
      desc: '进入竖屏视频详情页后点击返回',
      matchTime: 10000,
      actionMaximum: 1,
      resetMatch: 'match',
      rules: [
        {
          fastQuery: true,
          activityIds: 'com.xingin.matrix.detail.activity.DetailFeedActivity',
          matches: [
            '[name="com.xingin.redview.seekbar.VideoSeekBar"][visibleToUser=true]',
            '@[desc="返回"][clickable=true][visibleToUser=true] +2 [desc="搜索"][visibleToUser=true]',
          ],
        },
      ],
    },
`,
  },
  {
    file: 'src/apps/com.taobao.taobao.ts',
    activityId: 'com.taobao.taolive.room.TaoLiveVideoActivity',
    buildGroup: (key) => `    {
      key: ${key},
      name: '功能类-自动退出竖屏模式',
      desc: '进入淘宝直播竖屏页后点击关闭',
      matchTime: 10000,
      actionMaximum: 1,
      resetMatch: 'match',
      rules: [
        {
          fastQuery: true,
          activityIds: 'com.taobao.taolive.room.TaoLiveVideoActivity',
          matches:
            '@[desc="关闭"][clickable=true][visibleToUser=true] < LinearLayout < [vid="taolive_close_btn"]',
        },
      ],
    },
`,
  },
  {
    file: 'src/apps/com.tencent.mm.ts',
    activityId: 'com.tencent.mm.plugin.finder.ui.FinderHomeAffinityUI',
    buildGroup: (key) => `    {
      key: ${key},
      name: '功能类-自动退出竖屏模式',
      desc: '进入视频号竖屏播放页后点击返回',
      matchTime: 10000,
      actionMaximum: 1,
      resetMatch: 'match',
      rules: [
        {
          fastQuery: true,
          activityIds: 'com.tencent.mm.plugin.finder.ui.FinderHomeAffinityUI',
          matches: [
            '[desc="关注"][visibleToUser=true] +n [desc="推荐"][visibleToUser=true]',
            '@[vid="backBtn"][clickable=true][visibleToUser=true] > [desc="返回"]',
          ],
        },
      ],
    },
`,
  },
];

function findMatchingBracket(source, openIndex, openChar, closeChar) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = openIndex; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      i += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }
    if (char === '"' || char === '\'' || char === '`') {
      quote = char;
      continue;
    }
    if (char === openChar) depth += 1;
    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function groupsBody(source) {
  const groupsIndex = source.indexOf('groups: [');
  if (groupsIndex < 0) {
    throw new Error('Cannot find groups array');
  }
  const openIndex = source.indexOf('[', groupsIndex);
  const closeIndex = findMatchingBracket(source, openIndex, '[', ']');
  if (closeIndex < 0) {
    throw new Error('Cannot find groups array end');
  }
  return source.slice(openIndex + 1, closeIndex);
}

function nextGroupKey(source) {
  const body = groupsBody(source);
  let objectDepth = 0;
  let maxKey = -1;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];
    const next = body[i + 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      i += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }
    if (char === '"' || char === '\'' || char === '`') {
      quote = char;
      continue;
    }

    if (char === '{') {
      objectDepth += 1;
      continue;
    }
    if (char === '}') {
      objectDepth -= 1;
      continue;
    }
    if (objectDepth === 1 && body.startsWith('key:', i)) {
      const match = body.slice(i).match(/^key:\s*(-?\d+)/);
      if (match) {
        maxKey = Math.max(maxKey, Number(match[1]));
      }
    }
  }

  return maxKey + 1;
}

function insertGroup(source, group) {
  return source.replace(/\n {2}],\n}\);\s*$/, `\n${group}  ],\n});\n`);
}

for (const rule of privateRules) {
  const filePath = path.join(repoRoot, rule.file);
  let source = fs.readFileSync(filePath, 'utf8');

  if (
    source.includes('name: \'功能类-自动退出竖屏模式\'') &&
    source.includes(rule.activityId)
  ) {
    console.log(`skip ${rule.file}: private rule already exists`);
    continue;
  }

  const key = nextGroupKey(source);
  source = insertGroup(source, rule.buildGroup(key));
  fs.writeFileSync(filePath, source);
  console.log(`updated ${rule.file}: inserted key ${key}`);
}
