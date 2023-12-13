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
        const position = this.node.getPosition();
        const transform = this.node.getComponent(UITransform);
        this.node.addChild(guy);
        const x = math.randomRange(- transform.width / 2, transform.width / 2);
        const y = 0;
        // console.log(position.x, x, transform.width);
        const guyPosition = new math.Vec3(x, y, 0);
        guy.setPosition(guyPosition);
        setTimeout(this.generateGuy.bind(this), 200);
        setTimeout(() => {
            guy.destroy();
        }, 10000);
    }

}

