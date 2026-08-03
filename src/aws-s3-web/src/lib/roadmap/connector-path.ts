import type {
  AnchorSide,
  ConnectorDefinition,
  ConnectorPoint,
  LayoutBox,
} from "./blueprint";

export type Point = { x: number; y: number };

const CORNER_RADIUS = 16;

const round = (value: number) => Math.round(value * 100) / 100;

function format(value: number): number {
  return round(value);
}

export function anchorPoint(box: LayoutBox, side: AnchorSide): Point {
  if (side === "top") return { x: box.x + box.width / 2, y: box.y };
  if (side === "right") return { x: box.x + box.width, y: box.y + box.height / 2 };
  if (side === "bottom") return { x: box.x + box.width / 2, y: box.y + box.height };
  return { x: box.x, y: box.y + box.height / 2 };
}

function boxFor(
  endpoint: ConnectorDefinition["from"],
  boxesById: ReadonlyMap<string, LayoutBox>,
): LayoutBox {
  const box = boxesById.get(endpoint.nodeId);
  if (!box) throw new Error(`Missing connector box: ${endpoint.nodeId}`);
  return box;
}

function cubicPath(start: Point, end: Point, vertical: boolean): string {
  if (vertical) {
    const middleY = format((start.y + end.y) / 2);
    return `M ${format(start.x)} ${format(start.y)} C ${format(start.x)} ${middleY} ${format(end.x)} ${middleY} ${format(end.x)} ${format(end.y)}`;
  }

  const middleX = format((start.x + end.x) / 2);
  return `M ${format(start.x)} ${format(start.y)} C ${middleX} ${format(start.y)} ${middleX} ${format(end.y)} ${format(end.x)} ${format(end.y)}`;
}

function roundedOrthogonalPath(start: Point, end: Point, vertical: boolean): string {
  const horizontalDistance = Math.abs(end.x - start.x);
  const verticalDistance = Math.abs(end.y - start.y);
  const radius = Math.min(CORNER_RADIUS, horizontalDistance / 2, verticalDistance / 2);

  if (radius === 0) return `M ${format(start.x)} ${format(start.y)} L ${format(end.x)} ${format(end.y)}`;

  if (vertical) {
    const middleY = format((start.y + end.y) / 2);
    const verticalDirection = Math.sign(end.y - start.y) || 1;
    const horizontalDirection = Math.sign(end.x - start.x) || 1;
    return [
      `M ${format(start.x)} ${format(start.y)}`,
      `L ${format(start.x)} ${format(middleY - verticalDirection * radius)}`,
      `Q ${format(start.x)} ${middleY} ${format(start.x + horizontalDirection * radius)} ${middleY}`,
      `L ${format(end.x - horizontalDirection * radius)} ${middleY}`,
      `Q ${format(end.x)} ${middleY} ${format(end.x)} ${format(middleY + verticalDirection * radius)}`,
      `L ${format(end.x)} ${format(end.y)}`,
    ].join(" ");
  }

  const middleX = format((start.x + end.x) / 2);
  const horizontalDirection = Math.sign(end.x - start.x) || 1;
  const verticalDirection = Math.sign(end.y - start.y) || 1;
  return [
    `M ${format(start.x)} ${format(start.y)}`,
    `L ${format(middleX - horizontalDirection * radius)} ${format(start.y)}`,
    `Q ${middleX} ${format(start.y)} ${middleX} ${format(start.y + verticalDirection * radius)}`,
    `L ${middleX} ${format(end.y - verticalDirection * radius)}`,
    `Q ${middleX} ${format(end.y)} ${format(middleX + horizontalDirection * radius)} ${format(end.y)}`,
    `L ${format(end.x)} ${format(end.y)}`,
  ].join(" ");
}

function segmentLength(from: ConnectorPoint, to: ConnectorPoint): number {
  if (from.x !== to.x && from.y !== to.y) {
    throw new Error("Connector waypoints must form orthogonal segments");
  }
  return Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
}

function moveToward(
  from: ConnectorPoint,
  to: ConnectorPoint,
  distance: number,
): ConnectorPoint {
  const length = segmentLength(from, to);
  if (length === 0) return from;
  return {
    x: format(from.x + ((to.x - from.x) / length) * distance),
    y: format(from.y + ((to.y - from.y) / length) * distance),
  };
}

function roundedPolylinePath(points: readonly ConnectorPoint[]): string {
  const parts = [`M ${format(points[0].x)} ${format(points[0].y)}`];

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const corner = points[index];
    const next = points[index + 1];
    const radius = Math.min(
      CORNER_RADIUS,
      segmentLength(previous, corner) / 2,
      segmentLength(corner, next) / 2,
    );
    const entry = moveToward(corner, previous, radius);
    const exit = moveToward(corner, next, radius);
    parts.push(
      `L ${entry.x} ${entry.y}`,
      `Q ${format(corner.x)} ${format(corner.y)} ${exit.x} ${exit.y}`,
    );
  }

  const end = points.at(-1)!;
  parts.push(`L ${format(end.x)} ${format(end.y)}`);
  return parts.join(" ");
}

export function buildConnectorPath(
  connector: ConnectorDefinition,
  boxesById: ReadonlyMap<string, LayoutBox>,
): string {
  const start = anchorPoint(boxFor(connector.from, boxesById), connector.from.side);
  const end = anchorPoint(boxFor(connector.to, boxesById), connector.to.side);
  const vertical =
    connector.from.side === "top" ||
    connector.from.side === "bottom" ||
    connector.to.side === "top" ||
    connector.to.side === "bottom";

  if (connector.waypoints?.length) {
    return roundedPolylinePath([start, ...connector.waypoints, end]);
  }

  return connector.route === "curve"
    ? cubicPath(start, end, vertical)
    : roundedOrthogonalPath(start, end, vertical);
}
