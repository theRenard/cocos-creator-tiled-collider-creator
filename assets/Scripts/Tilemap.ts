import {
  _decorator,
  Component,
  Graphics,
  Node,
  PhysicsSystem2D,
  EPhysics2DDrawFlags,
  TiledLayer,
  PolygonCollider2D,
  Vec2,
  RigidBody2D,
  log,
  SpriteFrame,
  TextAsset,
  BoxCollider2D,
  UITransform,
  Sprite,
  Color,
  math,
} from "cc";
const { ccclass, property, requireComponent, executeInEditMode } = _decorator;
import { EDITOR } from "cc/env";
import polybool from "polybooljs";

type Polygon = {
  regions: number[][][];
  inverted: boolean;
};

@ccclass("Tilemap")
// @executeInEditMode(true)
@requireComponent(RigidBody2D)
export class Tilemap extends Component {
  private _matrix: number[][] = [];
  private _tileWidth: number = 16;
  private _tileHeight: number = 16;
  private _xOffset: number = 0;
  private _yOffset: number = 0;
  private _visited: number[][] = [];
  private _debugNode: Node | null = null;
  private _debugGraphics: Graphics | null = null;
  private _tileCoordinateGroups = new Map<string, Vec2[][]>(); // key: tileName, value: polygon
  private _tileCoordinateGroupsByValue = new Map<string, Vec2[][][]>(); // key: tileValue, value: polygon[]
  private _tileRectGroups = new Map<string, [Vec2, Vec2, Vec2, Vec2][]>();

  @property({ type: TextAsset })
  _textAsset: TextAsset | null = null;

  @property({ group: { name: "Collisions" }, type: TextAsset })
  private get Collisions() {
    return this._textAsset;
  }

  private set Collisions(value) {
    this._textAsset = value;
    this.initComponent();
  }

  @property
  private _mergeRects: boolean = true;

  @property({ group: { name: "Collisions" } })
  private get mergeRects() {
    return this._mergeRects;
  }

  private set mergeRects(value) {
    this._mergeRects = value;
    this.initComponent();
  }
  @property
  _debug: boolean = false;

  @property({ group: { name: "Collisions" } })
  private get debug() {
    return this._debug;
  }

  private set debug(value) {
    this._debug = value;
    this.initComponent();
  }

  @property({ group: { name: "Collisions" } })
  private get tileWidth() {
    return this._tileWidth;
  }

  private set tileWidth(value) {
    this._tileWidth = value;
    this.initComponent();
  }

  @property({ group: { name: "Collisions" } })
  private get tileHeight() {
    return this._tileHeight;
  }

  private set tileHeight(value) {
    this._tileHeight = value;
    this.initComponent();
  }

  _start() {
    this.initComponent();
  }

  /**
   * @description: Reset everything and create a new matrix
   */
  private reset() {
    this._matrix = [];
    this._visited = [];
    this._xOffset = 0;
    this._yOffset = 0;
    this._tileCoordinateGroups = new Map();
    this._tileCoordinateGroupsByValue = new Map();
    this._tileRectGroups = new Map();
    this.destroyAllChildrenDebugNodes();
    this.destroyAllChildrenColliders();
    this.destroyAllChildrenSprites();
    this._debugNode = null;
  }

  /**
   * @description: Destroy all the debug nodes in the parent node
   */
  private destroyAllChildrenDebugNodes() {
    this.node.children.forEach((child) => {
      if (child.name.includes(this.node.name + "_debug")) {
        child.destroy();
      }
    });
  }

  private destroyAllChildrenColliders() {
    this.node.children.forEach((child) => {
      if (child.name.includes("Colliders_")) {
        child.destroy();
      }
    });
  }

  private destroyAllChildrenSprites() {
    this.node.children.forEach((child) => {
      if (child.name.includes("Texture")) {
        child.destroy();
      }
    });
  }

  private createMatrixFromCSV(csv: string) {
    const lines = csv.trim().split("\n"); // Split the string into lines
    return (
      lines
        // remove the last element of the array if is a comma
        .map((line) =>
          line
            .split(",")
            .filter((n) => n !== "")
            .map((t) => parseInt(t))
        )
        .reverse()
    );
  }

  /**
   * @description: Iterate through the matrix and create polygons
   */
  private createTileGroups() {
    this._matrix.forEach((row, rowIndex) => {
      row.forEach((col, colIndex) => {
        if (this._visited[rowIndex][colIndex] !== 1) {
          this.checkMatrixAtPosition(
            rowIndex,
            colIndex,
            `${rowIndex}_${colIndex}`,
            this._matrix[rowIndex][colIndex]
          );
        }
      });
    });
  }

  /**
   * @description: Check the surrounding tiles of the current tile
   * @param row
   * @param col
   * @param groupRef
   * @returns void
   */
  private checkMatrixAtPosition(
    row: number,
    col: number,
    groupRef: string,
    value: number
  ) {
    // if row or col is out of bounds, return
    if (
      row < 0 ||
      col < 0 ||
      row >= this._matrix.length ||
      col >= this._matrix[0].length
    ) {
      // console.log("out of bounds");
      return;
    }

    // if tile is 0 (empty), return
    if (this._matrix[row][col] === 0) {
      // console.log("empty");
      return;
    }

    // if tile is already visited, return
    if (this._visited[row][col] === 1) {
      // console.log("already visited");
      return;
    }

    // if tile's value is not the same as the current tile, return
    if (this._matrix[row][col] !== value) {
      // console.log("not the same value");
      return;
    }

    // if tile is not visited, set it to visited
    this._visited[row][col] = 1;

    // if tile is in tiles, check the surrounding tiles
    this.checkMatrixAtPosition(row - 1, col, groupRef, value);
    this.checkMatrixAtPosition(row + 1, col, groupRef, value);
    this.checkMatrixAtPosition(row, col - 1, groupRef, value);
    this.checkMatrixAtPosition(row, col + 1, groupRef, value);

    // if tile is in tiles, add it to the polygon
    const vec = new Vec2(col, row);

    const groupName = `Layer_${this.node.name}.position_${groupRef}.value_${value}`;

    if (this._tileCoordinateGroups.has(groupName)) {
      this._tileCoordinateGroups.get(groupName)?.push([vec]);
    } else {
      this._tileCoordinateGroups.set(groupName, [[vec]]);
    }
  }

  /**
   * @description: Create a rectangle geometry
   * @param x
   * @param y
   * @returns Rect
   */
  private createRectGeometry(x: number, y: number) {
    const rect = math.rect(0, 0, this._tileWidth, this._tileHeight);
    rect.x = x;
    rect.y = y;
    return rect;
  }

  private createRectCoordinates(rect: math.Rect): [Vec2, Vec2, Vec2, Vec2] {
    return [
      new Vec2(rect.x, rect.y),
      new Vec2(rect.x + rect.width, rect.y),
      new Vec2(rect.x + rect.width, rect.y + rect.height),
      new Vec2(rect.x, rect.y + rect.height),
    ];
  }

  private createPolygon(polygon: number[][]): Polygon {
    return {
      regions: [polygon], // each region is a list of points
      inverted: false,
    };
  }

  // convert array of Vec2 to array of [x, y]
  private convertVec2ArrayToNumberArray(points: Vec2[]) {
    return points.map((point) => [point.x, point.y]);
  }

  // convert array of [x, y] to array of Vec2
  private convertNumberArrayToVec2Array(points: number[][]) {
    return points.map((point) => new Vec2(point[0], point[1]));
  }

  private createRectGroups() {
    this._tileCoordinateGroups.forEach((tileCoordinateGroup, groupName) => {
      this._tileRectGroups.set(groupName, []);

      tileCoordinateGroup.forEach((point) => {
        const rect = this.createRectGeometry(
          point[0].x * this._tileWidth - this._xOffset,
          point[0].y * this._tileHeight - this._yOffset
        );

        const rectCoordinates = this.createRectCoordinates(rect);

        this._tileRectGroups.get(groupName)?.push(rectCoordinates);
      });
    });
  }

  private aggregateRectGroupsByValue() {
    this._tileRectGroups.forEach((tileRectGroup, groupName) => {
      // get the value "2" as string from the group name like 'Layer_Collisions.position_0_20.value_2'
      const value = groupName.split("value_")[1];
      if (this._tileCoordinateGroupsByValue.has(value)) {
        this._tileCoordinateGroupsByValue.get(value)?.push(tileRectGroup);
      } else {
        this._tileCoordinateGroupsByValue.set(value, [tileRectGroup]);
      }
    });
  }

  private createPolygonColliders() {
    this._tileCoordinateGroupsByValue.forEach((tileRectGroupByValue, value) => {

      const colliderNode = new Node(`Colliders_${value}`);
      this.node.addChild(colliderNode);

      tileRectGroupByValue.forEach((tileRectGroup) => {
        if (this._mergeRects) {
          let result: Polygon = { regions: [], inverted: false };

          tileRectGroup.forEach((rectPoints) => {
            const tileRectGroupAsNumbers =
              this.convertVec2ArrayToNumberArray(rectPoints);
            const polygon = this.createPolygon(tileRectGroupAsNumbers);
            result = window.PolyBool.union(result, polygon);
          });

          const points = this.convertNumberArrayToVec2Array(result.regions[0]);

          if (!EDITOR) {
          }
          const collider = colliderNode.addComponent(PolygonCollider2D);
          collider.editing = true;
          collider.points = points;
          collider.group = 1 << parseInt(value);
          collider.apply();
          if (this._debug) {
            this.drawDebugNode(points);
          }
        } else {
          tileRectGroup.forEach((points) => {
            if (!EDITOR) {
              const collider = this.node.addComponent(BoxCollider2D);
              collider.editing = true;
              collider.offset = new Vec2(
                (points[0].x + points[2].x) / 2,
                (points[0].y + points[2].y) / 2
              );
              collider.size = math.size(
                points[2].x - points[0].x,
                points[2].y - points[0].y
              );
              collider.group = 1 << parseInt(value);
              collider.apply();
            }
            if (this._debug) {
              this.drawDebugNode(points);
            }
          });
        }
      });
    });
  }

  private drawDebugNode(points: Vec2[]) {
    this._debugGraphics?.moveTo(points[0].x, points[0].y);
    // random color
    this._debugGraphics.strokeColor = new Color(
      Math.random() * 255,
      Math.random() * 255,
      Math.random() * 255,
      255
    );
    this._debugGraphics.fillColor = new Color(
      Math.random() * 255,
      Math.random() * 255,
      Math.random() * 255,
      128
    );
    points = points.slice(1);
    points.forEach((point) => {
      this._debugGraphics?.lineTo(point.x, point.y);
    });
    // close the path
    this._debugGraphics?.close();
    this._debugGraphics?.stroke();
    this._debugGraphics?.fill();
  }

  /**
   * @description: Create a debug node with a square at the given position
   */
  private createDebugNode() {
    const nodeName = this.node.name + "_debug";
    this._debugNode = new Node(nodeName);
    this._debugNode.parent = this.node;
    this._debugNode
      .addComponent(UITransform)
      .setContentSize(this.node.getComponent(UITransform).contentSize);
    this._debugNode.setPosition(0, 0, 0);
    this._debugGraphics = this._debugNode.addComponent(Graphics);
    this._debugGraphics.lineWidth = 1;
    this._debugGraphics.strokeColor = new Color(255, 0, 0, 255);
    this._debugGraphics.fillColor = new Color(255, 0, 0, 128);
    this._debugGraphics.lineCap = Graphics.LineCap.SQUARE;
    this._debugGraphics.lineJoin = Graphics.LineJoin.MITER;
  }

  private setOffset() {
    const { contentSize } = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
    this._xOffset = contentSize.width / 2;
    this._yOffset = contentSize.height / 2;
  }

  private initComponent() {
    log("initComponent", this._debug);

    this.reset();
    this.setOffset();

    // add collision component
    if (this._textAsset) {
      this._matrix = this.createMatrixFromCSV(this._textAsset.text);
      this._visited = this._matrix.map(() => []);
      if (this.debug) this.createDebugNode();
      this.createTileGroups();
      this.createRectGroups();
      this.aggregateRectGroupsByValue();
      this.createPolygonColliders();
    } else {
      log("No CSV found for layer", this.node.name);
    }
  }

  onLoad() {
    if (this.debug) {
    PhysicsSystem2D.instance.debugDrawFlags =
      EPhysics2DDrawFlags.Aabb |
      EPhysics2DDrawFlags.Pair |
      EPhysics2DDrawFlags.CenterOfMass |
      EPhysics2DDrawFlags.Joint |
      EPhysics2DDrawFlags.Shape;
    }
  }

  start() {
    const tiledLayer = this.node.getComponent(TiledLayer);
    const { leftDownToCenterX, leftDownToCenterY } = tiledLayer;
    const { width, height } = tiledLayer.getMapTileSize();
    const vertices = tiledLayer.vertices;
    const points: [number, number][] = [];
    if (this.debug) console.log("vertices", vertices);
    for (const vertex of vertices) {
      if (vertex !== undefined) {
        const entries = Object.entries(vertex);

        for (const [key, value] of entries) {
          if (typeof value === "object") {
            const { left, bottom } = value;

            const tileVertices = [
              [left, bottom],
              [left + width, bottom],
              [left + width, bottom + height],
              [left, bottom + height],
            ];

            // push vertices
            for (const tileVertex of tileVertices) {
              points.push([
                tileVertex[0] - leftDownToCenterX,
                tileVertex[1] - leftDownToCenterY,
              ]);
            }
          }
        }
      }
    }

    console.log("points", points);

    const collider = this.node.addComponent(PolygonCollider2D);
    collider.points = points.map(([x, y]) => new Vec2(x, y));
    collider.apply();
  }
}
