"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZDC_Light = void 0;
// var desiredHue = -1,
//     desiredSaturation = -1; // HomeKit calls Hue/Saturation independently but we need both of them
// var desiredHueSatTimer; // timer to clear desired values if we don't get both
const ZD_Light_1 = require("./ZD_Light");
class ZDC_Light extends ZD_Light_1.ZD_Light {
    constructor(platform, accessory) {
        super(platform, accessory);
    }
    setServices() {
        super.setServices();
        this.service.getCharacteristic(this.platform.Characteristic.Saturation)
            .on('get', this.getSaturation.bind(this))
            .on('set', this.setSaturation.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.Hue)
            .on('get', this.getHue.bind(this))
            .on('set', this.setHue.bind(this));
        this.controller.registerCallback(this.accessory.UUID, this.context.type, this.context.groupNumber, this.platform.Characteristic.Hue, this.callbackHue.bind(this));
        this.controller.registerCallback(this.accessory.UUID, this.context.type, this.context.groupNumber, this.platform.Characteristic.Saturation, this.callbackSat.bind(this));
    }
    getHue(callback) {
        try {
            this.controller.GetColorAsync(this.context.color).then(colors => {
                this.context.hue = colors.Hue;
                // shouldn't need this
                // this.service.updateCharacteristic(this.platform.Characteristic.Hue, colors.Hue);
                // this.service.updateCharacteristic(this.platform.Characteristic.Saturation, colors.Sat);
                callback(null, this.context.hue);
            });
        }
        catch (err) {
            this.log.error(`${this.accessory.displayName} getHue error: ${err}`);
            callback(-70412 /* NOT_ALLOWED_IN_CURRENT_STATE */, false);
        }
    }
    ;
    setHue(desiredHue, callback) {
        this.desiredHue = desiredHue;
        this.hueCallback = callback;
        if (typeof this.satCallback !== 'undefined')
            setTimeout(() => { this.colorListSetCallbacks(); }, 100);
    }
    ;
    getSaturation(callback) {
        try {
            this.controller.GetColorAsync(this.context.color).then(colors => {
                this.context.saturation = colors.Sat;
                // shouldn't need this
                // this.service.updateCharacteristic(this.platform.Characteristic.Hue, colors.Hue);
                // this.service.updateCharacteristic(this.platform.Characteristic.Saturation, colors.Sat);
                callback(null, this.context.saturation);
            });
        }
        catch (err) {
            this.log.error(`${this.accessory.displayName} getSaturation error: ${err}`);
            callback(-70412 /* NOT_ALLOWED_IN_CURRENT_STATE */, false);
        }
    }
    ;
    setSaturation(desiredSaturation, callback) {
        this.desiredSaturation = desiredSaturation;
        this.satCallback = callback;
        if (typeof this.hueCallback !== 'undefined')
            setTimeout(() => { this.colorListSetCallbacks(); }, 200);
    }
    ;
    async colorListSet() {
        try {
            let status = await this.controller.ColorListSetAsync(this.context.color, this.desiredHue, this.desiredSaturation);
            if (status.Status > 0) {
                this.context.hue = this.desiredHue;
                this.context.saturation = this.desiredSaturation;
                this.desiredHue = undefined;
                this.desiredSaturation = undefined;
            }
            return status;
        }
        catch (err) {
            this.log.error(`${this.accessory.displayName} colorListSet error: ${err}`);
        }
        ;
    }
    colorListSetCallbacks() {
        try {
            this.colorListSet().then(() => {
                if (typeof this.satCallback === 'function')
                    this.satCallback(null);
                this.satCallback = undefined;
                if (typeof this.hueCallback === 'function')
                    this.hueCallback(null);
                this.hueCallback = undefined;
            });
        }
        catch (err) {
            this.log.error(`${this.accessory.displayName} colorListSetCallbacks error: ${err}`);
            if (typeof this.satCallback === 'function')
                this.satCallback(-70412 /* NOT_ALLOWED_IN_CURRENT_STATE */);
            this.satCallback = undefined;
            if (typeof this.hueCallback === 'function')
                this.hueCallback(-70412 /* NOT_ALLOWED_IN_CURRENT_STATE */);
            this.hueCallback = undefined;
        }
    }
    async groupListEditAsync(currentColor) {
        try {
            if (this.context.color === 0)
                return;
            // if the color paletto CXXX was change outside homebridge, but the user selects to set the color/brightness then make sure we assign the right color.
            var desiredColor = 250 - this.context.groupNumber + 1;
            if (currentColor !== desiredColor) {
                this.log.debug('%s color assignment was changed outside of HomeKit.  Changing to %s', this.accessory.displayName, desiredColor);
                this.context.color = desiredColor;
                await this.controller.GroupListEditAsync(this.accessory.displayName, this.context.groupNumber, this.context.color);
            }
            return Promise.resolve();
        }
        catch (err) {
            this.log.error(`${this.accessory.displayName} groupListEdit error: ${err}`);
            return Promise.reject();
        }
        ;
    }
    ;
    // this method used for event handling
    async getCurrentStateAsync() {
        return new Promise(async (resolve, reject) => {
            try {
                let group = await this.controller.GetGroupAsync(this.context.groupNumber);
                this.context.brightness = group.Intensity;
                this.context.isOn = this.context.brightness > 0;
                await this.groupListEditAsync(group.Color);
                let colors = await this.controller.GetColorAsync(this.context.color);
                if (colors.Hue !== this.context.hue || colors.Sat !== this.context.saturation) {
                    this.desiredHue = colors.Hue;
                    this.desiredSaturation = colors.Sat;
                    await this.colorListSet();
                }
                else {
                    this.context.hue = colors.Hue;
                    this.context.saturation = colors.Sat;
                }
                resolve();
            }
            catch (err) {
                this.log.error(`${this.accessory.displayName} getCurrentStateAsync error: ${err}`);
                reject(err);
            }
        });
    }
    setCharacteristics() {
        this.service.updateCharacteristic(this.platform.Characteristic.On, typeof this.context.isOn !== 'undefined' ? this.context.isOn : false);
        this.service.updateCharacteristic(this.platform.Characteristic.Brightness, typeof this.context.brightness !== 'undefined' ? this.context.brightness : 0);
        this.service.updateCharacteristic(this.platform.Characteristic.Hue, typeof this.context.hue !== 'undefined' ? this.context.hue : 0);
        this.service.updateCharacteristic(this.platform.Characteristic.Saturation, typeof this.context.saturation !== 'undefined' ? this.context.saturation : 0);
    }
    // this method used for callbacks
    callbackHue(hue) {
        if (hue !== this.context.hue && this.context.color !== 0) {
            this.context.hue = hue;
            // this.log.debug(`${this.accessory.displayName} updated hue to ${hue}.`);
            this.service.updateCharacteristic(this.platform.Characteristic.Hue, hue);
        }
    }
    ;
    callbackSat(saturation) {
        if (saturation !== this.context.saturation && this.context.color !== 0) {
            this.context.saturation = saturation;
            // this.log.debug(`${this.accessory.displayName} updated saturation to ${saturation}.`);
            this.service.updateCharacteristic(this.platform.Characteristic.Saturation, saturation);
        }
    }
    ;
}
exports.ZDC_Light = ZDC_Light;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiWkRDX0xpZ2h0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2xpZ2h0cy9aRENfTGlnaHQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EsdUJBQXVCO0FBQ3ZCLHFHQUFxRztBQUNyRyxnRkFBZ0Y7QUFDaEYseUNBQXNDO0FBTXRDLE1BQWEsU0FBVSxTQUFRLG1CQUFRO0lBS25DLFlBQVksUUFBdUIsRUFBRSxTQUE0QjtRQUM3RCxLQUFLLENBQUMsUUFBUSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQy9CLENBQUM7SUFFRCxXQUFXO1FBQ1AsS0FBSyxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBRXBCLElBQUksQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDO2FBQ2xFLEVBQUUsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDeEMsRUFBRSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBRTlDLElBQUksQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDO2FBQzNELEVBQUUsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDakMsRUFBRSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBRXZDLElBQUksQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDbEssSUFBSSxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUM3SyxDQUFDO0lBRUQsTUFBTSxDQUFDLFFBQW1DO1FBQ3RDLElBQUk7WUFDQSxJQUFJLENBQUMsVUFBVSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRTtnQkFDNUQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQztnQkFDOUIsc0JBQXNCO2dCQUN0QixtRkFBbUY7Z0JBQ25GLDBGQUEwRjtnQkFDMUYsUUFBUSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ3JDLENBQUMsQ0FBQyxDQUFBO1NBQ0w7UUFDRCxPQUFPLEdBQUcsRUFBRTtZQUNSLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLGtCQUFrQixHQUFHLEVBQUUsQ0FBQyxDQUFBO1lBQ3BFLFFBQVEsNENBQXlDLEtBQUssQ0FBQyxDQUFDO1NBQzNEO0lBRUwsQ0FBQztJQUFBLENBQUM7SUFDRixNQUFNLENBQUMsVUFBa0IsRUFBRSxRQUFtQztRQUMxRCxJQUFJLENBQUMsVUFBVSxHQUFHLFVBQVUsQ0FBQztRQUM3QixJQUFJLENBQUMsV0FBVyxHQUFHLFFBQVEsQ0FBQztRQUM1QixJQUFJLE9BQU8sSUFBSSxDQUFDLFdBQVcsS0FBSyxXQUFXO1lBQUUsVUFBVSxDQUFDLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxDQUFBLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQ3pHLENBQUM7SUFBQSxDQUFDO0lBRUYsYUFBYSxDQUFDLFFBQW1DO1FBQzdDLElBQUk7WUFDQSxJQUFJLENBQUMsVUFBVSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRTtnQkFDNUQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQztnQkFDckMsc0JBQXNCO2dCQUN0QixtRkFBbUY7Z0JBQ25GLDBGQUEwRjtnQkFDMUYsUUFBUSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQzVDLENBQUMsQ0FBQyxDQUFBO1NBQ0w7UUFDRCxPQUFPLEdBQUcsRUFBRTtZQUNSLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLHlCQUF5QixHQUFHLEVBQUUsQ0FBQyxDQUFBO1lBQzNFLFFBQVEsNENBQXlDLEtBQUssQ0FBQyxDQUFDO1NBQzNEO0lBQ0wsQ0FBQztJQUFBLENBQUM7SUFDRixhQUFhLENBQUMsaUJBQXlCLEVBQUUsUUFBbUM7UUFDeEUsSUFBSSxDQUFDLGlCQUFpQixHQUFHLGlCQUFpQixDQUFDO1FBQzNDLElBQUksQ0FBQyxXQUFXLEdBQUcsUUFBUSxDQUFDO1FBQzVCLElBQUksT0FBTyxJQUFJLENBQUMsV0FBVyxLQUFLLFdBQVc7WUFBRSxVQUFVLENBQUMsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUEsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDekcsQ0FBQztJQUFBLENBQUM7SUFDRixLQUFLLENBQUMsWUFBWTtRQUNkLElBQUk7WUFDQSxJQUFJLE1BQU0sR0FBRyxNQUFNLElBQUksQ0FBQyxVQUFVLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQztZQUNsSCxJQUFJLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO2dCQUNuQixJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDO2dCQUNuQyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUM7Z0JBQ2pELElBQUksQ0FBQyxVQUFVLEdBQUcsU0FBUyxDQUFDO2dCQUM1QixJQUFJLENBQUMsaUJBQWlCLEdBQUcsU0FBUyxDQUFDO2FBQ3RDO1lBQ0QsT0FBTyxNQUFNLENBQUM7U0FDakI7UUFDRCxPQUFPLEdBQUcsRUFBRTtZQUNSLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLHdCQUF3QixHQUFHLEVBQUUsQ0FBQyxDQUFBO1NBQzdFO1FBQUEsQ0FBQztJQUNOLENBQUM7SUFDRCxxQkFBcUI7UUFDakIsSUFBSTtZQUNBLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFO2dCQUMxQixJQUFJLE9BQU8sSUFBSSxDQUFDLFdBQVcsS0FBSyxVQUFVO29CQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ25FLElBQUksQ0FBQyxXQUFXLEdBQUcsU0FBUyxDQUFDO2dCQUM3QixJQUFJLE9BQU8sSUFBSSxDQUFDLFdBQVcsS0FBSyxVQUFVO29CQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ25FLElBQUksQ0FBQyxXQUFXLEdBQUcsU0FBUyxDQUFDO1lBQ2pDLENBQUMsQ0FBQyxDQUFDO1NBQ047UUFDRCxPQUFPLEdBQUcsRUFBRTtZQUNSLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLGlDQUFpQyxHQUFHLEVBQUUsQ0FBQyxDQUFBO1lBQ25GLElBQUksT0FBTyxJQUFJLENBQUMsV0FBVyxLQUFLLFVBQVU7Z0JBQUUsSUFBSSxDQUFDLFdBQVcsMkNBQXdDLENBQUM7WUFDckcsSUFBSSxDQUFDLFdBQVcsR0FBRyxTQUFTLENBQUM7WUFDN0IsSUFBSSxPQUFPLElBQUksQ0FBQyxXQUFXLEtBQUssVUFBVTtnQkFBRSxJQUFJLENBQUMsV0FBVywyQ0FBd0MsQ0FBQztZQUNyRyxJQUFJLENBQUMsV0FBVyxHQUFHLFNBQVMsQ0FBQztTQUNoQztJQUNMLENBQUM7SUFDRCxLQUFLLENBQUMsa0JBQWtCLENBQUMsWUFBb0I7UUFDekMsSUFBSTtZQUNBLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEtBQUssQ0FBQztnQkFBRSxPQUFPO1lBQ3JDLHNKQUFzSjtZQUN0SixJQUFJLFlBQVksR0FBRyxHQUFHLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLEdBQUcsQ0FBQyxDQUFDO1lBQ3RELElBQUksWUFBWSxLQUFLLFlBQVksRUFBRTtnQkFDL0IsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMscUVBQXFFLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLEVBQUUsWUFBWSxDQUFDLENBQUM7Z0JBQ2hJLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxHQUFHLFlBQVksQ0FBQztnQkFDbEMsTUFBTSxJQUFJLENBQUMsVUFBVSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7YUFDdEg7WUFDRCxPQUFPLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztTQUM1QjtRQUNELE9BQU8sR0FBRyxFQUFFO1lBQ1IsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcseUJBQXlCLEdBQUcsRUFBRSxDQUFDLENBQUM7WUFBQyxPQUFPLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQztTQUN4RztRQUFBLENBQUM7SUFDTixDQUFDO0lBQUEsQ0FBQztJQUVGLHNDQUFzQztJQUN0QyxLQUFLLENBQUMsb0JBQW9CO1FBQ3RCLE9BQU8sSUFBSSxPQUFPLENBQUMsS0FBSyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtZQUN6QyxJQUFJO2dCQUNBLElBQUksS0FBSyxHQUFHLE1BQU0sSUFBSSxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQztnQkFDMUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLEdBQUcsS0FBSyxDQUFDLFNBQVMsQ0FBQztnQkFDMUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDO2dCQUNoRCxNQUFNLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQzNDLElBQUksTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQTtnQkFDcEUsSUFBSSxNQUFNLENBQUMsR0FBRyxLQUFLLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxJQUFJLE1BQU0sQ0FBQyxHQUFHLEtBQUssSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUU7b0JBQzNFLElBQUksQ0FBQyxVQUFVLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQztvQkFDN0IsSUFBSSxDQUFDLGlCQUFpQixHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUM7b0JBQ3BDLE1BQU0sSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO2lCQUM3QjtxQkFDSTtvQkFDRCxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDO29CQUM5QixJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDO2lCQUN4QztnQkFDRCxPQUFPLEVBQUUsQ0FBQzthQUNiO1lBQ0QsT0FBTyxHQUFHLEVBQUU7Z0JBQ1IsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsZ0NBQWdDLEdBQUcsRUFBRSxDQUFDLENBQUE7Z0JBQ2xGLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQzthQUNmO1FBQ0wsQ0FBQyxDQUFDLENBQUE7SUFDTixDQUFDO0lBQ0Qsa0JBQWtCO1FBQ2QsSUFBSSxDQUFDLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxFQUFFLEVBQUUsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksS0FBSyxXQUFXLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN6SSxJQUFJLENBQUMsT0FBTyxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDLFVBQVUsRUFBRSxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3pKLElBQUksQ0FBQyxPQUFPLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsR0FBRyxFQUFFLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEtBQUssV0FBVyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDcEksSUFBSSxDQUFDLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxVQUFVLEVBQUUsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsS0FBSyxXQUFXLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM3SixDQUFDO0lBQ0QsaUNBQWlDO0lBQ2pDLFdBQVcsQ0FBQyxHQUFXO1FBQ25CLElBQUksR0FBRyxLQUFLLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxLQUFLLENBQUMsRUFBRTtZQUN0RCxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUM7WUFDdkIsMEVBQTBFO1lBQzFFLElBQUksQ0FBQyxPQUFPLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1NBQzVFO0lBQ0wsQ0FBQztJQUFBLENBQUM7SUFDRixXQUFXLENBQUMsVUFBa0I7UUFDMUIsSUFBSSxVQUFVLEtBQUssSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEtBQUssQ0FBQyxFQUFFO1lBQ3BFLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxHQUFHLFVBQVUsQ0FBQztZQUNyQyx3RkFBd0Y7WUFDeEYsSUFBSSxDQUFDLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxVQUFVLEVBQUUsVUFBVSxDQUFDLENBQUM7U0FDMUY7SUFDTCxDQUFDO0lBQUEsQ0FBQztDQUNMO0FBbEtELDhCQWtLQyIsInNvdXJjZXNDb250ZW50IjpbIlxuLy8gdmFyIGRlc2lyZWRIdWUgPSAtMSxcbi8vICAgICBkZXNpcmVkU2F0dXJhdGlvbiA9IC0xOyAvLyBIb21lS2l0IGNhbGxzIEh1ZS9TYXR1cmF0aW9uIGluZGVwZW5kZW50bHkgYnV0IHdlIG5lZWQgYm90aCBvZiB0aGVtXG4vLyB2YXIgZGVzaXJlZEh1ZVNhdFRpbWVyOyAvLyB0aW1lciB0byBjbGVhciBkZXNpcmVkIHZhbHVlcyBpZiB3ZSBkb24ndCBnZXQgYm90aFxuaW1wb3J0IHsgWkRfTGlnaHQgfSBmcm9tICcuL1pEX0xpZ2h0JztcblxuaW1wb3J0IHsgU2VydmljZSwgUGxhdGZvcm1BY2Nlc3NvcnksIENoYXJhY3RlcmlzdGljVmFsdWUsIENoYXJhY3RlcmlzdGljU2V0Q2FsbGJhY2ssIENoYXJhY3RlcmlzdGljR2V0Q2FsbGJhY2ssIEhhcFN0YXR1c0Vycm9yLCBIQVBTdGF0dXMgfSBmcm9tICdob21lYnJpZGdlJztcbmltcG9ydCB7IElDb250ZXh0LCBMdXhvclBsYXRmb3JtIH0gZnJvbSAnLi4vTHV4b3JQbGF0Zm9ybSc7XG5pbXBvcnQgeyBJU3RhdHVzIH0gZnJvbSAnLi4vY29udHJvbGxlci9CYXNlQ29udHJvbGxlcic7XG5cbmV4cG9ydCBjbGFzcyBaRENfTGlnaHQgZXh0ZW5kcyBaRF9MaWdodCB7XG4gICAgcHJpdmF0ZSBkZXNpcmVkSHVlOiBudW1iZXI7XG4gICAgcHJpdmF0ZSBkZXNpcmVkU2F0dXJhdGlvbjogbnVtYmVyXG4gICAgcHJpdmF0ZSBodWVDYWxsYmFjazogQ2hhcmFjdGVyaXN0aWNTZXRDYWxsYmFjaztcbiAgICBwcml2YXRlIHNhdENhbGxiYWNrOiBDaGFyYWN0ZXJpc3RpY1NldENhbGxiYWNrO1xuICAgIGNvbnN0cnVjdG9yKHBsYXRmb3JtOiBMdXhvclBsYXRmb3JtLCBhY2Nlc3Nvcnk6IFBsYXRmb3JtQWNjZXNzb3J5KSB7XG4gICAgICAgIHN1cGVyKHBsYXRmb3JtLCBhY2Nlc3NvcnkpO1xuICAgIH1cblxuICAgIHNldFNlcnZpY2VzKCkge1xuICAgICAgICBzdXBlci5zZXRTZXJ2aWNlcygpO1xuXG4gICAgICAgIHRoaXMuc2VydmljZS5nZXRDaGFyYWN0ZXJpc3RpYyh0aGlzLnBsYXRmb3JtLkNoYXJhY3RlcmlzdGljLlNhdHVyYXRpb24pXG4gICAgICAgICAgICAub24oJ2dldCcsIHRoaXMuZ2V0U2F0dXJhdGlvbi5iaW5kKHRoaXMpKVxuICAgICAgICAgICAgLm9uKCdzZXQnLCB0aGlzLnNldFNhdHVyYXRpb24uYmluZCh0aGlzKSk7XG5cbiAgICAgICAgdGhpcy5zZXJ2aWNlLmdldENoYXJhY3RlcmlzdGljKHRoaXMucGxhdGZvcm0uQ2hhcmFjdGVyaXN0aWMuSHVlKVxuICAgICAgICAgICAgLm9uKCdnZXQnLCB0aGlzLmdldEh1ZS5iaW5kKHRoaXMpKVxuICAgICAgICAgICAgLm9uKCdzZXQnLCB0aGlzLnNldEh1ZS5iaW5kKHRoaXMpKTtcblxuICAgICAgICB0aGlzLmNvbnRyb2xsZXIucmVnaXN0ZXJDYWxsYmFjayh0aGlzLmFjY2Vzc29yeS5VVUlELCB0aGlzLmNvbnRleHQudHlwZSwgdGhpcy5jb250ZXh0Lmdyb3VwTnVtYmVyLCB0aGlzLnBsYXRmb3JtLkNoYXJhY3RlcmlzdGljLkh1ZSwgdGhpcy5jYWxsYmFja0h1ZS5iaW5kKHRoaXMpKTtcbiAgICAgICAgdGhpcy5jb250cm9sbGVyLnJlZ2lzdGVyQ2FsbGJhY2sodGhpcy5hY2Nlc3NvcnkuVVVJRCwgdGhpcy5jb250ZXh0LnR5cGUsIHRoaXMuY29udGV4dC5ncm91cE51bWJlciwgdGhpcy5wbGF0Zm9ybS5DaGFyYWN0ZXJpc3RpYy5TYXR1cmF0aW9uLCB0aGlzLmNhbGxiYWNrU2F0LmJpbmQodGhpcykpO1xuICAgIH1cblxuICAgIGdldEh1ZShjYWxsYmFjazogQ2hhcmFjdGVyaXN0aWNHZXRDYWxsYmFjayk6IHZvaWQge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGhpcy5jb250cm9sbGVyLkdldENvbG9yQXN5bmModGhpcy5jb250ZXh0LmNvbG9yKS50aGVuKGNvbG9ycyA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5jb250ZXh0Lmh1ZSA9IGNvbG9ycy5IdWU7XG4gICAgICAgICAgICAgICAgLy8gc2hvdWxkbid0IG5lZWQgdGhpc1xuICAgICAgICAgICAgICAgIC8vIHRoaXMuc2VydmljZS51cGRhdGVDaGFyYWN0ZXJpc3RpYyh0aGlzLnBsYXRmb3JtLkNoYXJhY3RlcmlzdGljLkh1ZSwgY29sb3JzLkh1ZSk7XG4gICAgICAgICAgICAgICAgLy8gdGhpcy5zZXJ2aWNlLnVwZGF0ZUNoYXJhY3RlcmlzdGljKHRoaXMucGxhdGZvcm0uQ2hhcmFjdGVyaXN0aWMuU2F0dXJhdGlvbiwgY29sb3JzLlNhdCk7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgdGhpcy5jb250ZXh0Lmh1ZSk7XG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIHRoaXMubG9nLmVycm9yKGAke3RoaXMuYWNjZXNzb3J5LmRpc3BsYXlOYW1lfSBnZXRIdWUgZXJyb3I6ICR7ZXJyfWApXG4gICAgICAgICAgICBjYWxsYmFjayhIQVBTdGF0dXMuTk9UX0FMTE9XRURfSU5fQ1VSUkVOVF9TVEFURSwgZmFsc2UpO1xuICAgICAgICB9XG5cbiAgICB9O1xuICAgIHNldEh1ZShkZXNpcmVkSHVlOiBudW1iZXIsIGNhbGxiYWNrOiBDaGFyYWN0ZXJpc3RpY1NldENhbGxiYWNrKTogdm9pZCB7XG4gICAgICAgIHRoaXMuZGVzaXJlZEh1ZSA9IGRlc2lyZWRIdWU7XG4gICAgICAgIHRoaXMuaHVlQ2FsbGJhY2sgPSBjYWxsYmFjaztcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLnNhdENhbGxiYWNrICE9PSAndW5kZWZpbmVkJykgc2V0VGltZW91dCgoKSA9PiB7IHRoaXMuY29sb3JMaXN0U2V0Q2FsbGJhY2tzKCkgfSwgMTAwKTtcbiAgICB9O1xuICAgIFxuICAgIGdldFNhdHVyYXRpb24oY2FsbGJhY2s6IENoYXJhY3RlcmlzdGljR2V0Q2FsbGJhY2spOiB2b2lkIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHRoaXMuY29udHJvbGxlci5HZXRDb2xvckFzeW5jKHRoaXMuY29udGV4dC5jb2xvcikudGhlbihjb2xvcnMgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuY29udGV4dC5zYXR1cmF0aW9uID0gY29sb3JzLlNhdDtcbiAgICAgICAgICAgICAgICAvLyBzaG91bGRuJ3QgbmVlZCB0aGlzXG4gICAgICAgICAgICAgICAgLy8gdGhpcy5zZXJ2aWNlLnVwZGF0ZUNoYXJhY3RlcmlzdGljKHRoaXMucGxhdGZvcm0uQ2hhcmFjdGVyaXN0aWMuSHVlLCBjb2xvcnMuSHVlKTtcbiAgICAgICAgICAgICAgICAvLyB0aGlzLnNlcnZpY2UudXBkYXRlQ2hhcmFjdGVyaXN0aWModGhpcy5wbGF0Zm9ybS5DaGFyYWN0ZXJpc3RpYy5TYXR1cmF0aW9uLCBjb2xvcnMuU2F0KTtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCB0aGlzLmNvbnRleHQuc2F0dXJhdGlvbik7XG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIHRoaXMubG9nLmVycm9yKGAke3RoaXMuYWNjZXNzb3J5LmRpc3BsYXlOYW1lfSBnZXRTYXR1cmF0aW9uIGVycm9yOiAke2Vycn1gKVxuICAgICAgICAgICAgY2FsbGJhY2soSEFQU3RhdHVzLk5PVF9BTExPV0VEX0lOX0NVUlJFTlRfU1RBVEUsIGZhbHNlKTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgc2V0U2F0dXJhdGlvbihkZXNpcmVkU2F0dXJhdGlvbjogbnVtYmVyLCBjYWxsYmFjazogQ2hhcmFjdGVyaXN0aWNTZXRDYWxsYmFjayk6IHZvaWQge1xuICAgICAgICB0aGlzLmRlc2lyZWRTYXR1cmF0aW9uID0gZGVzaXJlZFNhdHVyYXRpb247XG4gICAgICAgIHRoaXMuc2F0Q2FsbGJhY2sgPSBjYWxsYmFjaztcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLmh1ZUNhbGxiYWNrICE9PSAndW5kZWZpbmVkJykgc2V0VGltZW91dCgoKSA9PiB7IHRoaXMuY29sb3JMaXN0U2V0Q2FsbGJhY2tzKCkgfSwgMjAwKTtcbiAgICB9O1xuICAgIGFzeW5jIGNvbG9yTGlzdFNldCgpOiBQcm9taXNlPElTdGF0dXM+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxldCBzdGF0dXMgPSBhd2FpdCB0aGlzLmNvbnRyb2xsZXIuQ29sb3JMaXN0U2V0QXN5bmModGhpcy5jb250ZXh0LmNvbG9yLCB0aGlzLmRlc2lyZWRIdWUsIHRoaXMuZGVzaXJlZFNhdHVyYXRpb24pO1xuICAgICAgICAgICAgaWYgKHN0YXR1cy5TdGF0dXMgPiAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jb250ZXh0Lmh1ZSA9IHRoaXMuZGVzaXJlZEh1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRleHQuc2F0dXJhdGlvbiA9IHRoaXMuZGVzaXJlZFNhdHVyYXRpb247XG4gICAgICAgICAgICAgICAgdGhpcy5kZXNpcmVkSHVlID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIHRoaXMuZGVzaXJlZFNhdHVyYXRpb24gPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc3RhdHVzO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIHRoaXMubG9nLmVycm9yKGAke3RoaXMuYWNjZXNzb3J5LmRpc3BsYXlOYW1lfSBjb2xvckxpc3RTZXQgZXJyb3I6ICR7ZXJyfWApXG4gICAgICAgIH07XG4gICAgfVxuICAgIGNvbG9yTGlzdFNldENhbGxiYWNrcygpOiB2b2lkIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHRoaXMuY29sb3JMaXN0U2V0KCkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzLnNhdENhbGxiYWNrID09PSAnZnVuY3Rpb24nKSB0aGlzLnNhdENhbGxiYWNrKG51bGwpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2F0Q2FsbGJhY2sgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzLmh1ZUNhbGxiYWNrID09PSAnZnVuY3Rpb24nKSB0aGlzLmh1ZUNhbGxiYWNrKG51bGwpO1xuICAgICAgICAgICAgICAgIHRoaXMuaHVlQ2FsbGJhY2sgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICB0aGlzLmxvZy5lcnJvcihgJHt0aGlzLmFjY2Vzc29yeS5kaXNwbGF5TmFtZX0gY29sb3JMaXN0U2V0Q2FsbGJhY2tzIGVycm9yOiAke2Vycn1gKVxuICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzLnNhdENhbGxiYWNrID09PSAnZnVuY3Rpb24nKSB0aGlzLnNhdENhbGxiYWNrKEhBUFN0YXR1cy5OT1RfQUxMT1dFRF9JTl9DVVJSRU5UX1NUQVRFKTtcbiAgICAgICAgICAgIHRoaXMuc2F0Q2FsbGJhY2sgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMuaHVlQ2FsbGJhY2sgPT09ICdmdW5jdGlvbicpIHRoaXMuaHVlQ2FsbGJhY2soSEFQU3RhdHVzLk5PVF9BTExPV0VEX0lOX0NVUlJFTlRfU1RBVEUpO1xuICAgICAgICAgICAgdGhpcy5odWVDYWxsYmFjayA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgIH1cbiAgICBhc3luYyBncm91cExpc3RFZGl0QXN5bmMoY3VycmVudENvbG9yOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmICh0aGlzLmNvbnRleHQuY29sb3IgPT09IDApIHJldHVybjtcbiAgICAgICAgICAgIC8vIGlmIHRoZSBjb2xvciBwYWxldHRvIENYWFggd2FzIGNoYW5nZSBvdXRzaWRlIGhvbWVicmlkZ2UsIGJ1dCB0aGUgdXNlciBzZWxlY3RzIHRvIHNldCB0aGUgY29sb3IvYnJpZ2h0bmVzcyB0aGVuIG1ha2Ugc3VyZSB3ZSBhc3NpZ24gdGhlIHJpZ2h0IGNvbG9yLlxuICAgICAgICAgICAgdmFyIGRlc2lyZWRDb2xvciA9IDI1MCAtIHRoaXMuY29udGV4dC5ncm91cE51bWJlciArIDE7XG4gICAgICAgICAgICBpZiAoY3VycmVudENvbG9yICE9PSBkZXNpcmVkQ29sb3IpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxvZy5kZWJ1ZygnJXMgY29sb3IgYXNzaWdubWVudCB3YXMgY2hhbmdlZCBvdXRzaWRlIG9mIEhvbWVLaXQuICBDaGFuZ2luZyB0byAlcycsIHRoaXMuYWNjZXNzb3J5LmRpc3BsYXlOYW1lLCBkZXNpcmVkQ29sb3IpO1xuICAgICAgICAgICAgICAgIHRoaXMuY29udGV4dC5jb2xvciA9IGRlc2lyZWRDb2xvcjtcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmNvbnRyb2xsZXIuR3JvdXBMaXN0RWRpdEFzeW5jKHRoaXMuYWNjZXNzb3J5LmRpc3BsYXlOYW1lLCB0aGlzLmNvbnRleHQuZ3JvdXBOdW1iZXIsIHRoaXMuY29udGV4dC5jb2xvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgdGhpcy5sb2cuZXJyb3IoYCR7dGhpcy5hY2Nlc3NvcnkuZGlzcGxheU5hbWV9IGdyb3VwTGlzdEVkaXQgZXJyb3I6ICR7ZXJyfWApOyByZXR1cm4gUHJvbWlzZS5yZWplY3QoKTtcbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgLy8gdGhpcyBtZXRob2QgdXNlZCBmb3IgZXZlbnQgaGFuZGxpbmdcbiAgICBhc3luYyBnZXRDdXJyZW50U3RhdGVBc3luYygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGFzeW5jIChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgbGV0IGdyb3VwID0gYXdhaXQgdGhpcy5jb250cm9sbGVyLkdldEdyb3VwQXN5bmModGhpcy5jb250ZXh0Lmdyb3VwTnVtYmVyKTtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRleHQuYnJpZ2h0bmVzcyA9IGdyb3VwLkludGVuc2l0eTtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRleHQuaXNPbiA9IHRoaXMuY29udGV4dC5icmlnaHRuZXNzID4gMDtcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmdyb3VwTGlzdEVkaXRBc3luYyhncm91cC5Db2xvcik7XG4gICAgICAgICAgICAgICAgbGV0IGNvbG9ycyA9IGF3YWl0IHRoaXMuY29udHJvbGxlci5HZXRDb2xvckFzeW5jKHRoaXMuY29udGV4dC5jb2xvcilcbiAgICAgICAgICAgICAgICBpZiAoY29sb3JzLkh1ZSAhPT0gdGhpcy5jb250ZXh0Lmh1ZSB8fCBjb2xvcnMuU2F0ICE9PSB0aGlzLmNvbnRleHQuc2F0dXJhdGlvbikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmRlc2lyZWRIdWUgPSBjb2xvcnMuSHVlO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmRlc2lyZWRTYXR1cmF0aW9uID0gY29sb3JzLlNhdDtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5jb2xvckxpc3RTZXQoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29udGV4dC5odWUgPSBjb2xvcnMuSHVlO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbnRleHQuc2F0dXJhdGlvbiA9IGNvbG9ycy5TYXQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxvZy5lcnJvcihgJHt0aGlzLmFjY2Vzc29yeS5kaXNwbGF5TmFtZX0gZ2V0Q3VycmVudFN0YXRlQXN5bmMgZXJyb3I6ICR7ZXJyfWApXG4gICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgfVxuICAgIHNldENoYXJhY3RlcmlzdGljcygpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5zZXJ2aWNlLnVwZGF0ZUNoYXJhY3RlcmlzdGljKHRoaXMucGxhdGZvcm0uQ2hhcmFjdGVyaXN0aWMuT24sIHR5cGVvZiB0aGlzLmNvbnRleHQuaXNPbiAhPT0gJ3VuZGVmaW5lZCcgPyB0aGlzLmNvbnRleHQuaXNPbiA6IGZhbHNlKTtcbiAgICAgICAgdGhpcy5zZXJ2aWNlLnVwZGF0ZUNoYXJhY3RlcmlzdGljKHRoaXMucGxhdGZvcm0uQ2hhcmFjdGVyaXN0aWMuQnJpZ2h0bmVzcywgdHlwZW9mIHRoaXMuY29udGV4dC5icmlnaHRuZXNzICE9PSAndW5kZWZpbmVkJyA/IHRoaXMuY29udGV4dC5icmlnaHRuZXNzIDogMCk7XG4gICAgICAgIHRoaXMuc2VydmljZS51cGRhdGVDaGFyYWN0ZXJpc3RpYyh0aGlzLnBsYXRmb3JtLkNoYXJhY3RlcmlzdGljLkh1ZSwgdHlwZW9mIHRoaXMuY29udGV4dC5odWUgIT09ICd1bmRlZmluZWQnID8gdGhpcy5jb250ZXh0Lmh1ZSA6IDApO1xuICAgICAgICB0aGlzLnNlcnZpY2UudXBkYXRlQ2hhcmFjdGVyaXN0aWModGhpcy5wbGF0Zm9ybS5DaGFyYWN0ZXJpc3RpYy5TYXR1cmF0aW9uLCB0eXBlb2YgdGhpcy5jb250ZXh0LnNhdHVyYXRpb24gIT09ICd1bmRlZmluZWQnID8gdGhpcy5jb250ZXh0LnNhdHVyYXRpb24gOiAwKTtcbiAgICB9XG4gICAgLy8gdGhpcyBtZXRob2QgdXNlZCBmb3IgY2FsbGJhY2tzXG4gICAgY2FsbGJhY2tIdWUoaHVlOiBudW1iZXIpOiB2b2lkIHtcbiAgICAgICAgaWYgKGh1ZSAhPT0gdGhpcy5jb250ZXh0Lmh1ZSAmJiB0aGlzLmNvbnRleHQuY29sb3IgIT09IDApIHtcbiAgICAgICAgICAgIHRoaXMuY29udGV4dC5odWUgPSBodWU7XG4gICAgICAgICAgICAvLyB0aGlzLmxvZy5kZWJ1ZyhgJHt0aGlzLmFjY2Vzc29yeS5kaXNwbGF5TmFtZX0gdXBkYXRlZCBodWUgdG8gJHtodWV9LmApO1xuICAgICAgICAgICAgdGhpcy5zZXJ2aWNlLnVwZGF0ZUNoYXJhY3RlcmlzdGljKHRoaXMucGxhdGZvcm0uQ2hhcmFjdGVyaXN0aWMuSHVlLCBodWUpO1xuICAgICAgICB9XG4gICAgfTtcbiAgICBjYWxsYmFja1NhdChzYXR1cmF0aW9uOiBudW1iZXIpOiB2b2lkIHtcbiAgICAgICAgaWYgKHNhdHVyYXRpb24gIT09IHRoaXMuY29udGV4dC5zYXR1cmF0aW9uICYmIHRoaXMuY29udGV4dC5jb2xvciAhPT0gMCkge1xuICAgICAgICAgICAgdGhpcy5jb250ZXh0LnNhdHVyYXRpb24gPSBzYXR1cmF0aW9uO1xuICAgICAgICAgICAgLy8gdGhpcy5sb2cuZGVidWcoYCR7dGhpcy5hY2Nlc3NvcnkuZGlzcGxheU5hbWV9IHVwZGF0ZWQgc2F0dXJhdGlvbiB0byAke3NhdHVyYXRpb259LmApO1xuICAgICAgICAgICAgdGhpcy5zZXJ2aWNlLnVwZGF0ZUNoYXJhY3RlcmlzdGljKHRoaXMucGxhdGZvcm0uQ2hhcmFjdGVyaXN0aWMuU2F0dXJhdGlvbiwgc2F0dXJhdGlvbik7XG4gICAgICAgIH1cbiAgICB9O1xufSJdfQ==