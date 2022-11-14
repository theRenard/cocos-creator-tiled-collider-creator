import { _decorator, Component, Node, Prefab, instantiate, UITransform, math } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('GuyGenerator')
export class GuyGenerator extends Component {

    @property({type: Prefab}) guyPrefab: Prefab = null;

    start() {
        this.generateGuy();
    }

    generateGuy() {
        const guy = instantiate(this.guyPrefab);
        const position = this.node.getWorldPosition();
        const transform = this.node.getComponent(UITransform);
        this.node.addChild(guy);
        const x = math.randomRange(position.x - transform.width / 2, position.x + transform.width / 2);
        const y = math.randomRange(position.y - transform.height / 2, position.y + transform.height / 2);
        const guyPosition = new math.Vec3(x, y, 0);
        this.node.setWorldPosition(guyPosition);
        setTimeout(this.generateGuy.bind(this), 500);
    }

}

