import type { AnchorSide, ConnectorDefinition, LayoutBox } from "./blueprint";

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

  return connector.route === "curve"
    ? cubicPath(start, end, vertical)
    : roundedOrthogonalPath(start, end, vertical);
}
