import type { RoadmapStage, RoadmapSubtopic, RoadmapTopic } from "@/types/roadmap";

/**
 * Geometry for the roadmap.sh-style flowchart.
 *
 * The canvas is a fixed-size coordinate space: every box gets an absolute
 * x/y/width/height and every connector an SVG path in the same space. The
 * viewport scales the whole thing to fit, exactly like roadmap.sh does, so the
 * layout maths never has to know the real viewport width.
 *
 * Topics sit on the central spine; their subtopics branch off to alternating
 * sides. Because consecutive topics branch opposite ways, their columns can
 * overlap vertically — that is what keeps a 24-topic roadmap from being twice
 * as tall as it needs to be. Each side therefore tracks its own low-water mark.
 */

const CANVAS_WIDTH = 1120;
const CANVAS_PADDING_BOTTOM = 72;

const TITLE = { width: 320, height: 74 } as const;
const LEGEND = { width: 336, height: 138 } as const;
const STAGE_LABEL = { width: 300, height: 42 } as const;
const TOPIC = { width: 340, height: 60 } as const;
const SUBTOPIC = { width: 282, height: 44 } as const;

/** Gap between stacked subtopics inside one column. */
const SUBTOPIC_GAP = 10;
/** Horizontal gap between the topic box edge and its subtopic column. */
const BRANCH_GAP = 76;
/** Minimum vertical gap between two topic boxes on the spine. */
const TOPIC_GAP = 46;
/** Minimum vertical gap between two subtopic columns on the same side. */
const COLUMN_GAP = 34;
/** Extra room around a stage divider label. */
const STAGE_LABEL_GAP = 40;
/** Vertical gap between the header row and the first stage. */
const HEADER_GAP = 64;
/** Corner radius on the elbow connectors. */
const ELBOW_RADIUS = 16;

export type LayoutBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LayoutStageLabel = LayoutBox & {
  stage: RoadmapStage;
};

export type LayoutTopic = LayoutBox & {
  topic: RoadmapTopic;
  stageId: string;
  /** Which side of the spine this topic's column sits on. */
  side: "left" | "right";
};

export type LayoutSubtopic = LayoutBox & {
  subtopic: RoadmapSubtopic;
  topicId: string;
  stageId: string;
  side: "left" | "right";
};

export type LayoutEdge = {
  id: string;
  d: string;
  kind: "spine" | "branch";
};

export type RoadmapLayout = {
  width: number;
  height: number;
  title: LayoutBox;
  legend: LayoutBox;
  stageLabels: readonly LayoutStageLabel[];
  topics: readonly LayoutTopic[];
  subtopics: readonly LayoutSubtopic[];
  edges: readonly LayoutEdge[];
};

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * A two-corner elbow from (sx, sy) to (ex, ey): out horizontally, down the
 * midline, then back out horizontally. Corners are rounded so the connectors
 * read as drawn rather than as a bar chart.
 */
export function elbowPath(sx: number, sy: number, ex: number, ey: number): string {
  const midX = round((sx + ex) / 2);
  const rise = ey - sy;

  if (Math.abs(rise) < 1) return `M ${round(sx)} ${round(sy)} L ${round(ex)} ${round(ey)}`;

  const hx = Math.sign(ex - sx) || 1;
  const vy = Math.sign(rise);
  const radius = Math.min(ELBOW_RADIUS, Math.abs(midX - sx), Math.abs(rise) / 2);

  return [
    `M ${round(sx)} ${round(sy)}`,
    `L ${round(midX - hx * radius)} ${round(sy)}`,
    `Q ${midX} ${round(sy)} ${midX} ${round(sy + vy * radius)}`,
    `L ${midX} ${round(ey - vy * radius)}`,
    `Q ${midX} ${round(ey)} ${round(midX + hx * radius)} ${round(ey)}`,
    `L ${round(ex)} ${round(ey)}`,
  ].join(" ");
}

export function buildRoadmapLayout(stages: readonly RoadmapStage[]): RoadmapLayout {
  const spineX = CANVAS_WIDTH / 2;

  const legend: LayoutBox = { x: 24, y: 0, ...LEGEND };
  const title: LayoutBox = {
    x: round(spineX - TITLE.width / 2),
    y: round((LEGEND.height - TITLE.height) / 2),
    ...TITLE,
  };

  const stageLabels: LayoutStageLabel[] = [];
  const topics: LayoutTopic[] = [];
  const subtopics: LayoutSubtopic[] = [];
  const edges: LayoutEdge[] = [];

  const headerBottom = Math.max(legend.y + legend.height, title.y + title.height);
  // Low-water mark per side, so alternating columns can interleave vertically.
  const sideBottom = { left: headerBottom, right: headerBottom };
  // The spine hops from the bottom of one box on the centre line to the top of
  // the next; that includes the stage dividers.
  let spineFrom = title.y + title.height;
  let previousBottom = headerBottom + HEADER_GAP - TOPIC_GAP;
  let topicIndex = 0;

  stages.forEach((stage) => {
    const labelY = round(previousBottom + STAGE_LABEL_GAP);
    const labelX = round(spineX - STAGE_LABEL.width / 2);
    stageLabels.push({ stage, x: labelX, y: labelY, ...STAGE_LABEL });

    edges.push({
      id: `spine-${stage.id}`,
      kind: "spine",
      d: `M ${spineX} ${round(spineFrom)} L ${spineX} ${labelY}`,
    });
    spineFrom = labelY + STAGE_LABEL.height;
    previousBottom = labelY + STAGE_LABEL.height;

    stage.topics.forEach((topic) => {
      const side = topicIndex % 2 === 0 ? "right" : "left";
      topicIndex += 1;

      const count = topic.subtopics.length;
      const columnHeight =
        count === 0 ? 0 : count * SUBTOPIC.height + (count - 1) * SUBTOPIC_GAP;
      // The topic box is centred on its column, so solve for the column top and
      // then push it down until both the same-side and spine constraints hold.
      const centreOffset = (columnHeight - TOPIC.height) / 2;

      let columnY = sideBottom[side] + COLUMN_GAP;
      if (columnY + centreOffset < previousBottom + TOPIC_GAP) {
        columnY = previousBottom + TOPIC_GAP - centreOffset;
      }

      const topicY = round(columnY + centreOffset);
      const topicX = round(spineX - TOPIC.width / 2);
      topics.push({ topic, stageId: stage.id, side, x: topicX, y: topicY, ...TOPIC });

      edges.push({
        id: `spine-${topic.id}`,
        kind: "spine",
        d: `M ${spineX} ${round(spineFrom)} L ${spineX} ${topicY}`,
      });
      spineFrom = topicY + TOPIC.height;

      const columnX =
        side === "right"
          ? round(topicX + TOPIC.width + BRANCH_GAP)
          : round(topicX - BRANCH_GAP - SUBTOPIC.width);
      const branchFromX = side === "right" ? topicX + TOPIC.width : topicX;
      const branchFromY = topicY + TOPIC.height / 2;
      const branchToX = side === "right" ? columnX : columnX + SUBTOPIC.width;

      topic.subtopics.forEach((subtopic, index) => {
        const y = round(columnY + index * (SUBTOPIC.height + SUBTOPIC_GAP));
        subtopics.push({
          subtopic,
          topicId: topic.id,
          stageId: stage.id,
          side,
          x: columnX,
          y,
          ...SUBTOPIC,
        });

        edges.push({
          id: `branch-${subtopic.id}`,
          kind: "branch",
          d: elbowPath(branchFromX, branchFromY, branchToX, y + SUBTOPIC.height / 2),
        });
      });

      sideBottom[side] = Math.max(sideBottom[side], columnY + columnHeight);
      previousBottom = topicY + TOPIC.height;
    });
  });

  const lowest = Math.max(previousBottom, sideBottom.left, sideBottom.right);

  return {
    width: CANVAS_WIDTH,
    height: round(lowest + CANVAS_PADDING_BOTTOM),
    title,
    legend,
    stageLabels,
    topics,
    subtopics,
    edges,
  };
}
