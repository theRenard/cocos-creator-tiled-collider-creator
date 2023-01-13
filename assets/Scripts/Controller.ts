import {
  _decorator,
  Component,
  input,
  Node,
  Input,
  EventKeyboard,
  KeyCode,
  CameraComponent,
} from "cc";
const { ccclass, property } = _decorator;

const SPEED = 40;
const CAMERA_LEFT_LIMIT = 0;
const CAMERA_RIGHT_LIMIT = 2000;
let direction = 1;

@ccclass("Controller")
export class Controller extends Component {
  @property({ type: CameraComponent }) camera: CameraComponent = null!;
  @property({ type: Node }) background: Node = null!;

  @property({ type: Node }) guyGenerator: Node = null!;

  lateUpdate(deltaTime: number) {
    const cameraPositon = this.camera.node.getPosition();
    const guyPosition = this.guyGenerator.getPosition();

    if (cameraPositon.x > CAMERA_RIGHT_LIMIT) {
      direction = -1;
    } else if (cameraPositon.x < CAMERA_LEFT_LIMIT) {
      direction = 1;
    }

    const amount = SPEED * direction * deltaTime;

    this.camera.node.setPosition(
      cameraPositon.x + amount,
      cameraPositon.y,
      0
    );
    this.guyGenerator.setPosition(
        guyPosition.x + amount,
        guyPosition.y,
        0
    );
    this.background.setPosition(
      cameraPositon.x + 0.5 * direction * deltaTime,
      cameraPositon.y,
      0
    );
  }
}
