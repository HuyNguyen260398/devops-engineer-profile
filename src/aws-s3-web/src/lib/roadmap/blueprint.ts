import type { RoadmapStage, RoadmapSubtopic, RoadmapTopic } from "@/types/roadmap";

import { buildConnectorPath } from "./connector-path";

export type LayoutBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AnchorSide = "top" | "right" | "bottom" | "left";
export type ConnectorRoute = "curve" | "orthogonal";

export type ClusterBlueprint = {
  stageId: string;
  topicId: string;
  topic: LayoutBox;
  subtopics: {
    x: number;
    y: number;
    columns: 1 | 2;
    columnWidth: number;
    rowHeight: number;
    columnGap: number;
    rowGap: number;
  };
  frame?: { id: string; label: string; padding: number };
  route: ConnectorRoute;
};

export type GraphBlueprint = {
  width: number;
  height: number;
  root: LayoutBox;
  legend: LayoutBox;
  stages: readonly (LayoutBox & { stageId: string })[];
  clusters: ClusterBlueprint[];
};

export type ResolvedTopic = LayoutBox & {
  topic: RoadmapTopic;
  stageId: string;
};

export type ResolvedSubtopic = LayoutBox & {
  subtopic: RoadmapSubtopic;
  topicId: string;
  stageId: string;
};

export type ResolvedGroup = LayoutBox & {
  id: string;
  label: string;
  memberIds: string[];
};

export type ConnectorEndpoint = { nodeId: string; side: AnchorSide };
export type ConnectorPoint = { x: number; y: number };

export type ConnectorDefinition = {
  id: string;
  kind: "primary" | "branch" | "alternative";
  route: ConnectorRoute;
  from: ConnectorEndpoint;
  to: ConnectorEndpoint;
  waypoints?: readonly ConnectorPoint[];
};

export type ResolvedConnector = ConnectorDefinition & { d: string };

export type ResolvedStage = LayoutBox & { stage: RoadmapStage };

export type ResolvedRoadmapLayout = {
  width: number;
  height: number;
  root: LayoutBox;
  legend: LayoutBox;
  stages: ResolvedStage[];
  groups: ResolvedGroup[];
  topics: ResolvedTopic[];
  subtopics: ResolvedSubtopic[];
  connectors: ResolvedConnector[];
};

type ContentMaps = {
  stagesById: Map<string, RoadmapStage>;
  topicsById: Map<string, RoadmapTopic>;
  topicStageById: Map<string, string>;
};

function createContentMaps(stages: readonly RoadmapStage[]): ContentMaps {
  const stagesById = new Map<string, RoadmapStage>();
  const topicsById = new Map<string, RoadmapTopic>();
  const topicStageById = new Map<string, string>();

  for (const stage of stages) {
    stagesById.set(stage.id, stage);
    for (const topic of stage.topics) {
      topicsById.set(topic.id, topic);
      topicStageById.set(topic.id, stage.id);
    }
  }

  return { stagesById, topicsById, topicStageById };
}

function boxContains(outer: LayoutBox, inner: LayoutBox): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

function boxesIntersect(a: LayoutBox, b: LayoutBox): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function isValidBox(box: LayoutBox): boolean {
  return box.width > 0 && box.height > 0;
}

function isInBounds(box: LayoutBox, layout: ResolvedRoadmapLayout): boolean {
  return boxContains({ x: 0, y: 0, width: layout.width, height: layout.height }, box);
}

export function compileRoadmapBlueprint(
  blueprint: GraphBlueprint,
  stages: readonly RoadmapStage[],
): ResolvedRoadmapLayout {
  const { stagesById, topicsById, topicStageById } = createContentMaps(stages);
  const referenceErrors: string[] = [];

  for (const stage of blueprint.stages) {
    if (!stagesById.has(stage.stageId)) {
      referenceErrors.push(`unknown stage: ${stage.stageId}`);
    }
  }

  for (const cluster of blueprint.clusters) {
    const topic = topicsById.get(cluster.topicId);
    if (!stagesById.has(cluster.stageId)) {
      referenceErrors.push(`unknown stage: ${cluster.stageId}`);
    }
    if (!topic) {
      referenceErrors.push(`unknown topic: ${cluster.topicId}`);
    } else if (topicStageById.get(cluster.topicId) !== cluster.stageId) {
      referenceErrors.push(`topic outside stage: ${cluster.topicId}`);
    }
  }

  if (referenceErrors.length > 0) {
    throw new Error(`Invalid roadmap blueprint:\n${referenceErrors.join("\n")}`);
  }

  const resolvedStages = blueprint.stages.map((entry) => ({
    ...entry,
    stage: stagesById.get(entry.stageId)!,
  }));
  const topics: ResolvedTopic[] = [];
  const subtopics: ResolvedSubtopic[] = [];
  const groups: ResolvedGroup[] = [];
  const connectors: ResolvedConnector[] = [];

  let previousTopicId = "roadmap-root";

  for (const cluster of blueprint.clusters) {
    const topic = topicsById.get(cluster.topicId)!;
    const resolvedTopic: ResolvedTopic = {
      ...cluster.topic,
      topic,
      stageId: cluster.stageId,
    };
    topics.push(resolvedTopic);

    connectors.push({
      id:
        previousTopicId === "roadmap-root"
          ? `primary-root-${topic.id}`
          : `primary-${previousTopicId}-${topic.id}`,
      kind: "primary",
      route: cluster.route,
      from: { nodeId: previousTopicId, side: "bottom" },
      to: { nodeId: topic.id, side: "top" },
      d: "",
    });
    previousTopicId = topic.id;

    const memberIds: string[] = [];
    topic.subtopics.forEach((subtopic, index) => {
      const column = index % cluster.subtopics.columns;
      const row = Math.floor(index / cluster.subtopics.columns);
      const resolvedSubtopic: ResolvedSubtopic = {
        x: cluster.subtopics.x + column * (cluster.subtopics.columnWidth + cluster.subtopics.columnGap),
        y: cluster.subtopics.y + row * (cluster.subtopics.rowHeight + cluster.subtopics.rowGap),
        width: cluster.subtopics.columnWidth,
        height: cluster.subtopics.rowHeight,
        subtopic,
        topicId: topic.id,
        stageId: cluster.stageId,
      };
      subtopics.push(resolvedSubtopic);
      memberIds.push(subtopic.id);

      const gridIsRightOfTopic = cluster.subtopics.x >= cluster.topic.x + cluster.topic.width;
      connectors.push({
        id: `branch-${topic.id}-${subtopic.id}`,
        kind: subtopic.importance === "optional" ? "alternative" : "branch",
        route: cluster.route,
        from: { nodeId: topic.id, side: gridIsRightOfTopic ? "right" : "left" },
        to: { nodeId: subtopic.id, side: gridIsRightOfTopic ? "left" : "right" },
        d: "",
      });
    });

    if (cluster.frame && memberIds.length > 0) {
      const members = subtopics.filter((entry) => entry.topicId === topic.id);
      const left = Math.min(...members.map((entry) => entry.x));
      const top = Math.min(...members.map((entry) => entry.y));
      const right = Math.max(...members.map((entry) => entry.x + entry.width));
      const bottom = Math.max(...members.map((entry) => entry.y + entry.height));
      groups.push({
        id: cluster.frame.id,
        label: cluster.frame.label,
        memberIds,
        x: left - cluster.frame.padding,
        y: top - cluster.frame.padding - 24,
        width: right - left + cluster.frame.padding * 2,
        height: bottom - top + cluster.frame.padding * 2 + 24,
      });
    }
  }

  const boxesById = new Map<string, LayoutBox>([["roadmap-root", blueprint.root]]);
  for (const entry of topics) boxesById.set(entry.topic.id, entry);
  for (const entry of subtopics) boxesById.set(entry.subtopic.id, entry);

  return {
    width: blueprint.width,
    height: blueprint.height,
    root: blueprint.root,
    legend: blueprint.legend,
    stages: resolvedStages,
    groups,
    topics,
    subtopics,
    connectors: connectors.map((connector) => ({
      ...connector,
      d: buildConnectorPath(connector, boxesById),
    })),
  };
}

export function validateRoadmapLayout(
  layout: ResolvedRoadmapLayout,
  stages: readonly RoadmapStage[],
): string[] {
  const errors: string[] = [];
  const expectedTopics = new Set(stages.flatMap((stage) => stage.topics.map((topic) => topic.id)));
  const expectedSubtopics = new Set(
    stages.flatMap((stage) => stage.topics.flatMap((topic) => topic.subtopics.map((subtopic) => subtopic.id))),
  );
  const nodes = new Map<string, LayoutBox>();
  const nodeEntries: { id: string; box: LayoutBox }[] = [];
  const placedTopicIds = new Set<string>();
  const placedSubtopicIds = new Set<string>();

  const addNode = (id: string, box: LayoutBox, placed: Set<string>) => {
    if (nodes.has(id)) errors.push(`duplicate node id: ${id}`);
    nodes.set(id, box);
    nodeEntries.push({ id, box });
    placed.add(id);
    if (!isValidBox(box)) errors.push(`invalid node dimensions: ${id}`);
    if (!isInBounds(box, layout)) errors.push(`node outside canvas: ${id}`);
  };

  addNode("roadmap-root", layout.root, new Set());
  for (const entry of layout.topics) addNode(entry.topic.id, entry, placedTopicIds);
  for (const entry of layout.subtopics) addNode(entry.subtopic.id, entry, placedSubtopicIds);

  for (const topicId of expectedTopics) {
    if (!placedTopicIds.has(topicId)) errors.push(`missing topic placement: ${topicId}`);
  }
  for (const subtopicId of expectedSubtopics) {
    if (!placedSubtopicIds.has(subtopicId)) errors.push(`missing subtopic placement: ${subtopicId}`);
  }

  for (let index = 0; index < nodeEntries.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < nodeEntries.length; otherIndex += 1) {
      const current = nodeEntries[index];
      const other = nodeEntries[otherIndex];
      if (boxesIntersect(current.box, other.box)) {
        errors.push(`overlapping nodes: ${current.id} / ${other.id}`);
      }
    }
  }

  const groupIds = new Set<string>();
  for (const group of layout.groups) {
    if (groupIds.has(group.id)) errors.push(`duplicate group id: ${group.id}`);
    groupIds.add(group.id);
    if (!isValidBox(group)) errors.push(`invalid group dimensions: ${group.id}`);
    if (!isInBounds(group, layout)) errors.push(`group outside canvas: ${group.id}`);
    for (const memberId of group.memberIds) {
      const member = nodes.get(memberId);
      if (!member) {
        errors.push(`unknown group member: ${memberId}`);
      } else if (!boxContains(group, member)) {
        errors.push(`group member outside bounds: ${memberId}`);
      }
    }
    const memberIds = new Set(group.memberIds);
    for (const node of nodeEntries) {
      if (!memberIds.has(node.id) && boxesIntersect(group, node.box)) {
        errors.push(`group overlaps node: ${group.id} / ${node.id}`);
      }
    }
  }

  const connectorIds = new Set<string>();
  for (const connector of layout.connectors) {
    if (connectorIds.has(connector.id)) errors.push(`duplicate connector id: ${connector.id}`);
    connectorIds.add(connector.id);
    if (!nodes.has(connector.from.nodeId)) {
      errors.push(`unknown connector source: ${connector.from.nodeId}`);
    }
    if (!nodes.has(connector.to.nodeId)) {
      errors.push(`unknown connector target: ${connector.to.nodeId}`);
    }
  }

  return errors;
}
