export type MoveFace = 'U' | 'D' | 'L' | 'R' | 'F' | 'B' | 'unknown';
export type MoveSuffix = '' | "'" | '2' | 'unknown';
export type MoveDirection = 'clockwise' | 'counterclockwise' | 'half-turn' | 'unknown';

export interface MoveDescriptor {
  notation: string;
  face: MoveFace;
  suffix: MoveSuffix;
  turns: 0 | 1 | 2;
  direction: MoveDirection;
  familyKey: string;
}

export interface MoveLesson {
  descriptor: MoveDescriptor;
  titleEn: string;
  titleZh: string;
  instructionEn: string;
  instructionZh: string;
  selfCheckEn: string;
  selfCheckZh: string;
}

interface FaceCopy {
  nameEn: string;
  nameZh: string;
  placeEn: string;
  placeZh: string;
}

const FACE_COPY: Record<Exclude<MoveFace, 'unknown'>, FaceCopy> = {
  U: { nameEn: 'Up', nameZh: '上面', placeEn: 'up face', placeZh: '上面' },
  D: { nameEn: 'Down', nameZh: '下面', placeEn: 'down face', placeZh: '下面' },
  L: { nameEn: 'Left', nameZh: '左面', placeEn: 'left face', placeZh: '左面' },
  R: { nameEn: 'Right', nameZh: '右面', placeEn: 'right face', placeZh: '右面' },
  F: { nameEn: 'Front', nameZh: '前面', placeEn: 'front face', placeZh: '前面' },
  B: { nameEn: 'Back', nameZh: '后面', placeEn: 'back face', placeZh: '后面' },
};

const MOVE_RE = /^([UDLRFB])(['2]?)$/;

export function describeMove(move: string): MoveDescriptor {
  const notation = move.trim();
  const match = MOVE_RE.exec(notation);
  if (!match) {
    return {
      notation,
      face: 'unknown',
      suffix: 'unknown',
      turns: 0,
      direction: 'unknown',
      familyKey: `unknown:${notation}`,
    };
  }

  const face = match[1] as Exclude<MoveFace, 'unknown'>;
  const suffix = match[2] as Exclude<MoveSuffix, 'unknown'>;
  const turns = suffix === '2' ? 2 : 1;
  const direction: MoveDirection = suffix === "'" ? 'counterclockwise' : suffix === '2' ? 'half-turn' : 'clockwise';

  return {
    notation,
    face,
    suffix,
    turns,
    direction,
    familyKey: face,
  };
}

export function getMoveLesson(move: string): MoveLesson {
  const descriptor = describeMove(move);
  if (descriptor.face === 'unknown') {
    return {
      descriptor,
      titleEn: `${descriptor.notation || 'Unknown'}: Follow the preview`,
      titleZh: `${descriptor.notation || '未知'}：跟随预览`,
      instructionEn: 'This is not one of the six basic face turns. Follow the 3D preview for this move.',
      instructionZh: '这不是六个基础面转之一。请跟随 3D 预览完成这一步。',
      selfCheckEn: 'Watch the preview first, then try to repeat the same motion on your cube.',
      selfCheckZh: '先看预览，再尝试在你的魔方上复现同样的动作。',
    };
  }

  const face = FACE_COPY[descriptor.face];
  if (descriptor.direction === 'half-turn') {
    return {
      descriptor,
      titleEn: `${descriptor.notation}: ${face.nameEn} face half turn`,
      titleZh: `${descriptor.notation}：${face.nameZh}转 180 度`,
      instructionEn: `Turn the ${face.placeEn} 180 degrees. Direction does not matter for a half turn.`,
      instructionZh: `把${face.placeZh}转 180 度。转 180 度时顺时针或逆时针结果一样。`,
      selfCheckEn: `Before revealing, point to the ${face.placeEn} and remember that "2" means two quarter turns.`,
      selfCheckZh: `揭示答案前，先指出${face.placeZh}，并记住“2”表示两个 90 度。`,
    };
  }

  const clockwise = descriptor.direction === 'clockwise';
  return {
    descriptor,
    titleEn: `${descriptor.notation}: ${face.nameEn} face ${clockwise ? 'clockwise' : 'counterclockwise'}`,
    titleZh: `${descriptor.notation}：${face.nameZh}${clockwise ? '顺时针' : '逆时针'}`,
    instructionEn: `Turn the ${face.placeEn} ${clockwise ? 'clockwise' : 'counterclockwise'} one quarter turn, judged as if you are looking straight at that face.`,
    instructionZh: `把${face.placeZh}${clockwise ? '顺时针' : '逆时针'}转 90 度。方向按你正对这个面时看到的方向判断。`,
    selfCheckEn: `Before revealing, point to the ${face.placeEn} and decide whether it turns ${clockwise ? 'clockwise' : 'counterclockwise'}.`,
    selfCheckZh: `揭示答案前，先指出${face.placeZh}，再判断它要${clockwise ? '顺时针' : '逆时针'}转。`,
  };
}
