"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LuxorPlatform = void 0;
const axios = require('axios').default;
const BaseController_1 = require("./controller/BaseController");
const ControllerFactory_1 = require("./controller/ControllerFactory");
const LightFactory_1 = require("./lights/LightFactory");
const ZD_Light_1 = require("./lights/ZD_Light");
class LuxorPlatform {
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;
        // this is used to track restored cached accessories
        this.accessories = [];
        this.currGroupsAndThemes = [];
        this.config = config;
        this.log = log;
        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;
        this.Name = config.name;
        this.lastDateAdded = Date.now();
        this.controller = ControllerFactory_1.ControllerFactory.createController({ type: 'base' }, this.log);
        if (api) {
            // Save the API object as plugin needs to register new this.api.platformAccessory via this object.
            this.api = api;
            // Listen to event "didFinishLaunching", this means homebridge already finished loading cached accessories
            // Platform Plugin should only register new this.api.platformAccessory that doesn't exist in homebridge after this event.
            // Or start discover new accessories
            this.api.on('didFinishLaunching', this.didFinishLaunchingAsync.bind(this));
        }
    }
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    // Function invoked when homebridge tries to restore cached accessory
    // Developer can configure accessory at here (like setup event handler)
    configureAccessory(accessory) {
        this.log.debug(`Retrieved cached accessory ${accessory.displayName} with UUID ${accessory.UUID}`);
        this.accessories[accessory.UUID] = accessory;
    }
    async getControllerAsync() {
        // get the name of the controller
        this.log.info(this.Name + ": Starting search for controller at: " + this.config.ipAddr);
        try {
            //Search for controllor and make sure we can find it
            const response = await axios.post(`http://${this.config.ipAddr}/ControllerName.json`);
            if (response.status !== 200) {
                this.log.error('Received a status code of ' + response.status + ' when trying to connect to the controller.');
                return false;
            }
            let controllerNameData = response.data;
            controllerNameData.ip = this.config.ipAddr;
            controllerNameData.platform = this;
            controllerNameData.commandTimeout = this.config.commandTimeout;
            if (controllerNameData.Controller.substring(0, 5) === 'luxor') {
                controllerNameData.type = BaseController_1.IControllerType.ZD;
            }
            else if (controllerNameData.Controller.substring(0, 5) === 'lxzdc') {
                controllerNameData.type = BaseController_1.IControllerType.ZDC;
            }
            else if (controllerNameData.Controller.substring(0, 5) === 'lxtwo') {
                controllerNameData.type = BaseController_1.IControllerType.ZDTWO;
            }
            else {
                controllerNameData.type = BaseController_1.IControllerType.ZDTWO;
                this.log.info('Found unknown controller named %s of type %s, assuming a ZDTWO', controllerNameData.Controller, controllerNameData.type);
            }
            this.log.info(`Found Controller named ${controllerNameData.Controller} of type ${controllerNameData.type}.`);
            this.controller = ControllerFactory_1.ControllerFactory.createController(controllerNameData, this.log);
            return true;
        }
        catch (err) {
            this.log.error(this.Name + ' was not able to connect to connect to the controller. ', err);
            return false;
        }
        ;
    }
    async getControllerGroupListAsync() {
        // Get the list of light groups from the controller
        if (this.config.hideGroups)
            return;
        try {
            let groupLists = await this.controller.GroupListGetAsync();
            this.log.info(`Retrieved ${groupLists.length} light groups from controller.`);
            for (var i in groupLists) {
                this.currGroupsAndThemes.push(groupLists[i]);
            }
        }
        catch (err) {
            this.log.error(`was not able to retrieve light groups from controller.\n${err}\n${err}`);
        }
        ;
    }
    async getControllerThemeListAsync() {
        // Get the list of light LuxorThemes from the controller
        try {
            let themeLists = await this.controller.ThemeListGetAsync();
            this.log.info(`Retrieved ${themeLists.length} themes from controller.`);
            if (typeof this.config.noAllThemes !== 'undefined' && this.config.noAllThemes) {
                this.log.info(`Not creating Illuminate All and Extinguish All themes per config setting.`);
            }
            else {
                themeLists.push({
                    Name: 'Illuminate all lights',
                    ThemeIndex: 100,
                    OnOff: 0,
                    isOn: false,
                    type: ZD_Light_1.ILightType.THEME
                });
                themeLists.push({
                    Name: 'Extinguish all lights',
                    ThemeIndex: 101,
                    OnOff: 0,
                    isOn: false,
                    type: ZD_Light_1.ILightType.THEME
                });
            }
            for (var i in themeLists) {
                themeLists[i].type = ZD_Light_1.ILightType.THEME;
                this.currGroupsAndThemes.push(themeLists[i]);
            }
        }
        catch (err) {
            this.log.error('was not able to retrieve light themes from controller.', err);
        }
        ;
    }
    removeAccessories() {
        for (var UUID in this.accessories) {
            let accessory = this.accessories[UUID];
            if (typeof this.config.removeAllAccessories !== 'undefined' && this.config.removeAllAccessories || typeof this.config.removeAccessories !== 'undefined' && this.config.removeAccessories.includes(accessory.UUID)) {
                this.log.info(`Removing cached accessory ${accessory.displayName} with UUID ${accessory.UUID} per platform configuration settings.`);
                this.api.unregisterPlatformAccessories("homebridge-luxor", "Luxor", [accessory]);
                this.accessories = this.accessories.filter(item => item.UUID !== UUID);
            }
            ;
        }
    }
    addGroupAccessory(lightGroup) {
        var accessory = new this.api.platformAccessory(lightGroup.Name, lightGroup.UUID);
        let context = {
            lastDateAdded: this.lastDateAdded,
            color: lightGroup.Color,
            groupNumber: lightGroup.GroupNumber,
            brightness: lightGroup.Intensity,
            type: lightGroup.type,
            isOn: lightGroup.Intensity > 0,
            independentColors: this.config.independentColors,
            commandTimeout: this.config.commandTimeout
        };
        accessory.context = context;
        LightFactory_1.LightFactory.createLight(this, accessory);
        this.api.registerPlatformAccessories("homebridge-luxor", "Luxor", [accessory]);
    }
    addThemeAccessory(themeGroup) {
        var accessory = new this.api.platformAccessory(themeGroup.Name, themeGroup.UUID);
        let context = {
            lastDateAdded: this.lastDateAdded,
            type: ZD_Light_1.ILightType.THEME,
            isOn: themeGroup.OnOff === 1,
            themeIndex: themeGroup.ThemeIndex,
            OnOff: themeGroup.OnOff,
            commandTimeout: this.config.commandTimeout
        };
        accessory.context = context;
        LightFactory_1.LightFactory.createLight(this, accessory);
        this.accessories[accessory.UUID] = accessory;
        this.api.registerPlatformAccessories("homebridge-luxor", "Luxor", [accessory]);
    }
    assignUUIDs() {
        for (let i = 0; i < this.currGroupsAndThemes.length; i++) {
            let acc = this.currGroupsAndThemes[i];
            if (typeof acc.ThemeIndex !== 'undefined') {
                acc.UUID = this.api.hap.uuid.generate('luxor.' + `theme-${acc.ThemeIndex}`);
            }
            else {
                acc.UUID = this.api.hap.uuid.generate('luxor.' + `group.-${acc.GroupNumber}`);
            }
        }
    }
    async processAccessories() {
        this.assignUUIDs();
        this.removeAccessories();
        for (var UUID in this.accessories) {
            let cachedAcc = this.accessories[UUID];
            // look for match on current devices
            let remove = true;
            for (let j = 0; j < this.currGroupsAndThemes.length; j++) {
                let currAcc = this.currGroupsAndThemes[j];
                if (cachedAcc.UUID === currAcc.UUID) {
                    // found existing device
                    this.log.info(`Loading cached accessory ${cachedAcc.displayName} with UUID ${cachedAcc.UUID}.`);
                    // update cached device (name, etc)
                    let context = cachedAcc.context;
                    context.lastDateAdded = this.lastDateAdded;
                    if (typeof currAcc.Color !== 'undefined')
                        context.color = currAcc.Color;
                    if (typeof currAcc.GroupNumber !== 'undefined')
                        context.groupNumber = currAcc.GroupNumber;
                    if (typeof currAcc.ThemeIndex !== 'undefined')
                        context.themeIndex = currAcc.ThemeIndex;
                    if (typeof currAcc.Intensity !== 'undefined') {
                        context.brightness = currAcc.Intensity;
                        context.isOn = currAcc.Intensity > 0;
                    }
                    if (typeof currAcc.type !== 'undefined')
                        context.type = currAcc.type;
                    if (typeof currAcc.isOn !== 'undefined')
                        context.isOn = currAcc.isOn;
                    if (typeof currAcc.Name !== 'undefined')
                        cachedAcc.displayName = currAcc.Name;
                    cachedAcc.context = context;
                    this.api.updatePlatformAccessories([cachedAcc]);
                    LightFactory_1.LightFactory.createLight(this, cachedAcc);
                    this.currGroupsAndThemes.splice(j, 1);
                    remove = false;
                    break;
                }
            }
            // remove the cachedAcc that can't be matched
            if (remove) {
                this.log.info(`Removing cached accessory ${cachedAcc.displayName} with UUID ${cachedAcc.UUID}.`);
                this.api.unregisterPlatformAccessories("homebridge-luxor", "Luxor", [cachedAcc]);
            }
        }
        // add any new accessories that were not previously matched
        if (this.currGroupsAndThemes.length > 0) {
            for (let j = 0; j < this.currGroupsAndThemes.length; j++) {
                let currAcc = this.currGroupsAndThemes[j];
                this.log.info(`Adding new accessory ${currAcc.Name} with UUID ${currAcc.UUID}.`);
                if (currAcc.type === ZD_Light_1.ILightType.THEME)
                    this.addThemeAccessory(currAcc);
                else
                    this.addGroupAccessory(currAcc);
            }
        }
    }
    async didFinishLaunchingAsync() {
        if (!this.config.ipAddr) {
            this.log.error(this.Name + " needs an IP Address in the config file.  Please see sample_config.json.");
        }
        try {
            let isConnected = false;
            while (!isConnected) {
                isConnected = await this.getControllerAsync();
                this.log.info(`Unable to connect to Luxor controller.  Waiting 60s and will retry.`);
                await this.sleep(60 * 1000);
            }
            //this.retrieveCachedAccessories();
            await this.getControllerGroupListAsync();
            await this.getControllerThemeListAsync();
            await this.processAccessories();
            // this.removeOphanedAccessories();
            this.log.info('Finished initializing');
        }
        catch (err) {
            this.log.error('Error in didFinishLaunching', err);
        }
        ;
    }
}
exports.LuxorPlatform = LuxorPlatform;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTHV4b3JQbGF0Zm9ybS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9MdXhvclBsYXRmb3JtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUM7QUFJdkMsZ0VBQXNHO0FBQ3RHLHNFQUFtRTtBQUNuRSx3REFBcUQ7QUFFckQsZ0RBQStDO0FBSS9DLE1BQWEsYUFBYTtJQVV0QixZQUNvQixHQUFXLEVBQ1gsTUFBc0IsRUFDdEIsR0FBUTtRQUZSLFFBQUcsR0FBSCxHQUFHLENBQVE7UUFDWCxXQUFNLEdBQU4sTUFBTSxDQUFnQjtRQUN0QixRQUFHLEdBQUgsR0FBRyxDQUFLO1FBWjVCLG9EQUFvRDtRQUM3QyxnQkFBVyxHQUF3QixFQUFFLENBQUM7UUFNckMsd0JBQW1CLEdBQWdDLEVBQUUsQ0FBQztRQU8xRCxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztRQUNyQixJQUFJLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztRQUNmLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDO1FBQ3BDLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDO1FBQ2xELElBQUksQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQztRQUN4QixJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUNoQyxJQUFJLENBQUMsVUFBVSxHQUFHLHFDQUFpQixDQUFDLGdCQUFnQixDQUFDLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQTtRQUVoRixJQUFJLEdBQUcsRUFBRTtZQUNMLGtHQUFrRztZQUNsRyxJQUFJLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FB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QUN6QixJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUU7WUFDckIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksR0FBRywwRUFBMEUsQ0FBQyxDQUFDO1NBQzFHO1FBQ0QsSUFBSTtZQUNBLElBQUksV0FBVyxHQUFHLEtBQUssQ0FBQztZQUN4QixPQUFPLENBQUMsV0FBVyxFQUFDO2dCQUNoQixXQUFXLEdBQUcsTUFBTSxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztnQkFDOUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMscUVBQXFFLENBQUMsQ0FBQTtnQkFDcEYsTUFBTSxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsR0FBQyxJQUFJLENBQUMsQ0FBQzthQUM3QjtZQUNELG1DQUFtQztZQUNuQyxNQUFNLElBQUksQ0FBQywyQkFBMkIsRUFBRSxDQUFDO1lBQ3pDLE1BQU0sSUFBSSxDQUFDLDJCQUEyQixFQUFFLENBQUM7WUFDekMsTUFBTSxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztZQUNoQyxtQ0FBbUM7WUFDbkMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsQ0FBQztTQUMxQztRQUNELE9BQU8sR0FBRyxFQUFFO1lBQ1IsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsNkJBQTZCLEVBQUUsR0FBRyxDQUFDLENBQUM7U0FDdEQ7UUFBQSxDQUFDO0lBQ04sQ0FBQztDQUNKO0FBL1BELHNDQStQQyIsInNvdXJjZXNDb250ZW50IjpbImNvbnN0IGF4aW9zID0gcmVxdWlyZSgnYXhpb3MnKS5kZWZhdWx0O1xuaW1wb3J0IHsgQXhpb3NSZXNwb25zZSB9IGZyb20gJ2F4aW9zJztcbmltcG9ydCB7IEFQSSwgQ2hhcmFjdGVyaXN0aWMsIER5bmFtaWNQbGF0Zm9ybVBsdWdpbiwgTG9nZ2VyLCBQbGF0Zm9ybUFjY2Vzc29yeSwgUGxhdGZvcm1Db25maWcsIFNlcnZpY2UgfSBmcm9tICdob21lYnJpZGdlJztcblxuaW1wb3J0IHsgQmFzZUNvbnRyb2xsZXIsIElDb250cm9sbGVyVHlwZSwgSUdyb3VwTGlzdCwgSVRoZW1lTGlzdCB9IGZyb20gJy4vY29udHJvbGxlci9CYXNlQ29udHJvbGxlcic7XG5pbXBvcnQgeyBDb250cm9sbGVyRmFjdG9yeSB9IGZyb20gJy4vY29udHJvbGxlci9Db250cm9sbGVyRmFjdG9yeSc7XG5pbXBvcnQgeyBMaWdodEZhY3RvcnkgfSBmcm9tICcuL2xpZ2h0cy9MaWdodEZhY3RvcnknO1xuaW1wb3J0IHsgVGhlbWUgfSBmcm9tICcuL2xpZ2h0cy9UaGVtZSc7XG5pbXBvcnQgeyBJTGlnaHRUeXBlIH0gZnJvbSAnLi9saWdodHMvWkRfTGlnaHQnO1xuXG5cblxuZXhwb3J0IGNsYXNzIEx1eG9yUGxhdGZvcm0gaW1wbGVtZW50cyBEeW5hbWljUGxhdGZvcm1QbHVnaW4ge1xuICAgIC8vIHRoaXMgaXMgdXNlZCB0byB0cmFjayByZXN0b3JlZCBjYWNoZWQgYWNjZXNzb3JpZXNcbiAgICBwdWJsaWMgYWNjZXNzb3JpZXM6IFBsYXRmb3JtQWNjZXNzb3J5W10gPSBbXTtcbiAgICBwdWJsaWMgY29udHJvbGxlcjogQmFzZUNvbnRyb2xsZXI7Ly8gd2lsbCBiZSBhc3NpZ25lZCB0byBaRCBvciBaREMgY29udHJvbGxlclxuICAgIHB1YmxpYyBOYW1lOiBzdHJpbmc7XG4gICAgcHVibGljIGxhc3REYXRlQWRkZWQ6IG51bWJlcjtcbiAgICBwdWJsaWMgcmVhZG9ubHkgU2VydmljZTogdHlwZW9mIFNlcnZpY2U7XG4gICAgcHVibGljIHJlYWRvbmx5IENoYXJhY3RlcmlzdGljOiB0eXBlb2YgQ2hhcmFjdGVyaXN0aWM7XG4gICAgcHJpdmF0ZSBjdXJyR3JvdXBzQW5kVGhlbWVzOiBJR3JvdXBMaXN0W10gJiBJVGhlbWVMaXN0W10gPSBbXTtcblxuICAgIGNvbnN0cnVjdG9yKFxuICAgICAgICBwdWJsaWMgcmVhZG9ubHkgbG9nOiBMb2dnZXIsXG4gICAgICAgIHB1YmxpYyByZWFkb25seSBjb25maWc6IFBsYXRmb3JtQ29uZmlnLFxuICAgICAgICBwdWJsaWMgcmVhZG9ubHkgYXBpOiBBUElcbiAgICApIHtcbiAgICAgICAgdGhpcy5jb25maWcgPSBjb25maWc7XG4gICAgICAgIHRoaXMubG9nID0gbG9nO1xuICAgICAgICB0aGlzLlNlcnZpY2UgPSB0aGlzLmFwaS5oYXAuU2VydmljZTtcbiAgICAgICAgdGhpcy5DaGFyYWN0ZXJpc3RpYyA9IHRoaXMuYXBpLmhhcC5DaGFyYWN0ZXJpc3RpYztcbiAgICAgICAgdGhpcy5OYW1lID0gY29uZmlnLm5hbWU7XG4gICAgICAgIHRoaXMubGFzdERhdGVBZGRlZCA9IERhdGUubm93KCk7XG4gICAgICAgIHRoaXMuY29udHJvbGxlciA9IENvbnRyb2xsZXJGYWN0b3J5LmNyZWF0ZUNvbnRyb2xsZXIoeyB0eXBlOiAnYmFzZScgfSwgdGhpcy5sb2cpXG5cbiAgICAgICAgaWYgKGFwaSkge1xuICAgICAgICAgICAgLy8gU2F2ZSB0aGUgQVBJIG9iamVjdCBhcyBwbHVnaW4gbmVlZHMgdG8gcmVnaXN0ZXIgbmV3IHRoaXMuYXBpLnBsYXRmb3JtQWNjZXNzb3J5IHZpYSB0aGlzIG9iamVjdC5cbiAgICAgICAgICAgIHRoaXMuYXBpID0gYXBpO1xuXG4gICAgICAgICAgICAvLyBMaXN0ZW4gdG8gZXZlbnQgXCJkaWRGaW5pc2hMYXVuY2hpbmdcIiwgdGhpcyBtZWFucyBob21lYnJpZGdlIGFscmVhZHkgZmluaXNoZWQgbG9hZGluZyBjYWNoZWQgYWNjZXNzb3JpZXNcbiAgICAgICAgICAgIC8vIFBsYXRmb3JtIFBsdWdpbiBzaG91bGQgb25seSByZWdpc3RlciBuZXcgdGhpcy5hcGkucGxhdGZvcm1BY2Nlc3NvcnkgdGhhdCBkb2Vzbid0IGV4aXN0IGluIGhvbWVicmlkZ2UgYWZ0ZXIgdGhpcyBldmVudC5cbiAgICAgICAgICAgIC8vIE9yIHN0YXJ0IGRpc2NvdmVyIG5ldyBhY2Nlc3Nvcmllc1xuICAgICAgICAgICAgdGhpcy5hcGkub24oJ2RpZEZpbmlzaExhdW5jaGluZycsIHRoaXMuZGlkRmluaXNoTGF1bmNoaW5nQXN5bmMuYmluZCh0aGlzKSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgYXN5bmMgc2xlZXAobXMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCBtcykpO1xuICAgIH1cbiAgICAvLyBGdW5jdGlvbiBpbnZva2VkIHdoZW4gaG9tZWJyaWRnZSB0cmllcyB0byByZXN0b3JlIGNhY2hlZCBhY2Nlc3NvcnlcbiAgICAvLyBEZXZlbG9wZXIgY2FuIGNvbmZpZ3VyZSBhY2Nlc3NvcnkgYXQgaGVyZSAobGlrZSBzZXR1cCBldmVudCBoYW5kbGVyKVxuICAgIGNvbmZpZ3VyZUFjY2Vzc29yeShhY2Nlc3Nvcnk6IFBsYXRmb3JtQWNjZXNzb3J5KSB7XG4gICAgICAgIHRoaXMubG9nLmRlYnVnKGBSZXRyaWV2ZWQgY2FjaGVkIGFjY2Vzc29yeSAke2FjY2Vzc29yeS5kaXNwbGF5TmFtZX0gd2l0aCBVVUlEICR7YWNjZXNzb3J5LlVVSUR9YCk7XG4gICAgICAgIHRoaXMuYWNjZXNzb3JpZXNbYWNjZXNzb3J5LlVVSURdID0gYWNjZXNzb3J5O1xuICAgIH1cbiAgICBhc3luYyBnZXRDb250cm9sbGVyQXN5bmMoKTpQcm9taXNlPGJvb2xlYW4+IHtcbiAgICAgICAgLy8gZ2V0IHRoZSBuYW1lIG9mIHRoZSBjb250cm9sbGVyXG5cbiAgICAgICAgdGhpcy5sb2cuaW5mbyh0aGlzLk5hbWUgKyBcIjogU3RhcnRpbmcgc2VhcmNoIGZvciBjb250cm9sbGVyIGF0OiBcIiArIHRoaXMuY29uZmlnLmlwQWRkcik7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvL1NlYXJjaCBmb3IgY29udHJvbGxvciBhbmQgbWFrZSBzdXJlIHdlIGNhbiBmaW5kIGl0XG4gICAgICAgICAgICBjb25zdCByZXNwb25zZTpBeGlvc1Jlc3BvbnNlID0gYXdhaXQgYXhpb3MucG9zdChcbiAgICAgICAgICAgICAgICBgaHR0cDovLyR7dGhpcy5jb25maWcuaXBBZGRyfS9Db250cm9sbGVyTmFtZS5qc29uYFxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgaWYgKHJlc3BvbnNlLnN0YXR1cyAhPT0gMjAwKSB7IHRoaXMubG9nLmVycm9yKCdSZWNlaXZlZCBhIHN0YXR1cyBjb2RlIG9mICcgKyByZXNwb25zZS5zdGF0dXMgKyAnIHdoZW4gdHJ5aW5nIHRvIGNvbm5lY3QgdG8gdGhlIGNvbnRyb2xsZXIuJyk7IHJldHVybiBmYWxzZTsgfVxuICAgICAgICAgICAgbGV0IGNvbnRyb2xsZXJOYW1lRGF0YSA9IHJlc3BvbnNlLmRhdGE7XG4gICAgICAgICAgICBjb250cm9sbGVyTmFtZURhdGEuaXAgPSB0aGlzLmNvbmZpZy5pcEFkZHI7XG4gICAgICAgICAgICBjb250cm9sbGVyTmFtZURhdGEucGxhdGZvcm0gPSB0aGlzO1xuICAgICAgICAgICAgY29udHJvbGxlck5hbWVEYXRhLmNvbW1hbmRUaW1lb3V0ID0gdGhpcy5jb25maWcuY29tbWFuZFRpbWVvdXQ7XG4gICAgICAgICAgICBpZiAoY29udHJvbGxlck5hbWVEYXRhLkNvbnRyb2xsZXIuc3Vic3RyaW5nKDAsIDUpID09PSAnbHV4b3InKSB7XG4gICAgICAgICAgICAgICAgY29udHJvbGxlck5hbWVEYXRhLnR5cGUgPSBJQ29udHJvbGxlclR5cGUuWkQ7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNvbnRyb2xsZXJOYW1lRGF0YS5Db250cm9sbGVyLnN1YnN0cmluZygwLCA1KSA9PT0gJ2x4emRjJykge1xuICAgICAgICAgICAgICAgIGNvbnRyb2xsZXJOYW1lRGF0YS50eXBlID0gSUNvbnRyb2xsZXJUeXBlLlpEQztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY29udHJvbGxlck5hbWVEYXRhLkNvbnRyb2xsZXIuc3Vic3RyaW5nKDAsIDUpID09PSAnbHh0d28nKSB7XG4gICAgICAgICAgICAgICAgY29udHJvbGxlck5hbWVEYXRhLnR5cGUgPSBJQ29udHJvbGxlclR5cGUuWkRUV087XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnRyb2xsZXJOYW1lRGF0YS50eXBlID0gSUNvbnRyb2xsZXJUeXBlLlpEVFdPO1xuICAgICAgICAgICAgICAgIHRoaXMubG9nLmluZm8oJ0ZvdW5kIHVua25vd24gY29udHJvbGxlciBuYW1lZCAlcyBvZiB0eXBlICVzLCBhc3N1bWluZyBhIFpEVFdPJywgY29udHJvbGxlck5hbWVEYXRhLkNvbnRyb2xsZXIsIGNvbnRyb2xsZXJOYW1lRGF0YS50eXBlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMubG9nLmluZm8oYEZvdW5kIENvbnRyb2xsZXIgbmFtZWQgJHtjb250cm9sbGVyTmFtZURhdGEuQ29udHJvbGxlcn0gb2YgdHlwZSAke2NvbnRyb2xsZXJOYW1lRGF0YS50eXBlfS5gKTtcbiAgICAgICAgICAgIHRoaXMuY29udHJvbGxlciA9IENvbnRyb2xsZXJGYWN0b3J5LmNyZWF0ZUNvbnRyb2xsZXIoY29udHJvbGxlck5hbWVEYXRhLCB0aGlzLmxvZyk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICB0aGlzLmxvZy5lcnJvcih0aGlzLk5hbWUgKyAnIHdhcyBub3QgYWJsZSB0byBjb25uZWN0IHRvIGNvbm5lY3QgdG8gdGhlIGNvbnRyb2xsZXIuICcsIGVycik7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH07XG5cbiAgICB9XG4gICAgYXN5bmMgZ2V0Q29udHJvbGxlckdyb3VwTGlzdEFzeW5jKCkge1xuICAgICAgICAvLyBHZXQgdGhlIGxpc3Qgb2YgbGlnaHQgZ3JvdXBzIGZyb20gdGhlIGNvbnRyb2xsZXJcbiAgICAgICAgaWYgKHRoaXMuY29uZmlnLmhpZGVHcm91cHMpIHJldHVybjtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxldCBncm91cExpc3RzID0gYXdhaXQgdGhpcy5jb250cm9sbGVyLkdyb3VwTGlzdEdldEFzeW5jKCk7XG4gICAgICAgICAgICB0aGlzLmxvZy5pbmZvKGBSZXRyaWV2ZWQgJHtncm91cExpc3RzLmxlbmd0aH0gbGlnaHQgZ3JvdXBzIGZyb20gY29udHJvbGxlci5gKTtcbiAgICAgICAgICAgIGZvciAodmFyIGkgaW4gZ3JvdXBMaXN0cykge1xuICAgICAgICAgICAgICAgIHRoaXMuY3Vyckdyb3Vwc0FuZFRoZW1lcy5wdXNoKGdyb3VwTGlzdHNbaV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIHRoaXMubG9nLmVycm9yKGB3YXMgbm90IGFibGUgdG8gcmV0cmlldmUgbGlnaHQgZ3JvdXBzIGZyb20gY29udHJvbGxlci5cXG4ke2Vycn1cXG4ke2Vycn1gKTtcbiAgICAgICAgfTtcbiAgICB9XG4gICAgYXN5bmMgZ2V0Q29udHJvbGxlclRoZW1lTGlzdEFzeW5jKCkge1xuICAgICAgICAvLyBHZXQgdGhlIGxpc3Qgb2YgbGlnaHQgTHV4b3JUaGVtZXMgZnJvbSB0aGUgY29udHJvbGxlclxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbGV0IHRoZW1lTGlzdHMgPSBhd2FpdCB0aGlzLmNvbnRyb2xsZXIuVGhlbWVMaXN0R2V0QXN5bmMoKTtcbiAgICAgICAgICAgIHRoaXMubG9nLmluZm8oYFJldHJpZXZlZCAke3RoZW1lTGlzdHMubGVuZ3RofSB0aGVtZXMgZnJvbSBjb250cm9sbGVyLmApO1xuXG4gICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMuY29uZmlnLm5vQWxsVGhlbWVzICE9PSAndW5kZWZpbmVkJyAmJiB0aGlzLmNvbmZpZy5ub0FsbFRoZW1lcyl7XG4gICAgICAgICAgICAgICAgdGhpcy5sb2cuaW5mbyhgTm90IGNyZWF0aW5nIElsbHVtaW5hdGUgQWxsIGFuZCBFeHRpbmd1aXNoIEFsbCB0aGVtZXMgcGVyIGNvbmZpZyBzZXR0aW5nLmApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhlbWVMaXN0cy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgTmFtZTogJ0lsbHVtaW5hdGUgYWxsIGxpZ2h0cycsXG4gICAgICAgICAgICAgICAgICAgIFRoZW1lSW5kZXg6IDEwMCxcbiAgICAgICAgICAgICAgICAgICAgT25PZmY6IDAsXG4gICAgICAgICAgICAgICAgICAgIGlzT246IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBJTGlnaHRUeXBlLlRIRU1FXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgdGhlbWVMaXN0cy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgTmFtZTogJ0V4dGluZ3Vpc2ggYWxsIGxpZ2h0cycsXG4gICAgICAgICAgICAgICAgICAgIFRoZW1lSW5kZXg6IDEwMSxcbiAgICAgICAgICAgICAgICAgICAgT25PZmY6IDAsXG4gICAgICAgICAgICAgICAgICAgIGlzT246IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBJTGlnaHRUeXBlLlRIRU1FXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKHZhciBpIGluIHRoZW1lTGlzdHMpIHtcbiAgICAgICAgICAgICAgICB0aGVtZUxpc3RzW2ldLnR5cGUgPSBJTGlnaHRUeXBlLlRIRU1FO1xuICAgICAgICAgICAgICAgIHRoaXMuY3Vyckdyb3Vwc0FuZFRoZW1lcy5wdXNoKHRoZW1lTGlzdHNbaV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIHRoaXMubG9nLmVycm9yKCd3YXMgbm90IGFibGUgdG8gcmV0cmlldmUgbGlnaHQgdGhlbWVzIGZyb20gY29udHJvbGxlci4nLCBlcnIpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHJlbW92ZUFjY2Vzc29yaWVzKCkge1xuICAgICAgICBmb3IgKHZhciBVVUlEIGluIHRoaXMuYWNjZXNzb3JpZXMpIHtcbiAgICAgICAgICAgIGxldCBhY2Nlc3NvcnkgPSB0aGlzLmFjY2Vzc29yaWVzW1VVSURdO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzLmNvbmZpZy5yZW1vdmVBbGxBY2Nlc3NvcmllcyAhPT0gJ3VuZGVmaW5lZCcgJiYgdGhpcy5jb25maWcucmVtb3ZlQWxsQWNjZXNzb3JpZXMgfHwgdHlwZW9mIHRoaXMuY29uZmlnLnJlbW92ZUFjY2Vzc29yaWVzICE9PSAndW5kZWZpbmVkJyAmJiB0aGlzLmNvbmZpZy5yZW1vdmVBY2Nlc3Nvcmllcy5pbmNsdWRlcyhhY2Nlc3NvcnkuVVVJRCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxvZy5pbmZvKGBSZW1vdmluZyBjYWNoZWQgYWNjZXNzb3J5ICR7YWNjZXNzb3J5LmRpc3BsYXlOYW1lfSB3aXRoIFVVSUQgJHthY2Nlc3NvcnkuVVVJRH0gcGVyIHBsYXRmb3JtIGNvbmZpZ3VyYXRpb24gc2V0dGluZ3MuYCk7XG4gICAgICAgICAgICAgICAgdGhpcy5hcGkudW5yZWdpc3RlclBsYXRmb3JtQWNjZXNzb3JpZXMoXCJob21lYnJpZGdlLWx1eG9yXCIsIFwiTHV4b3JcIiwgW2FjY2Vzc29yeV0pO1xuICAgICAgICAgICAgICAgIHRoaXMuYWNjZXNzb3JpZXMgPSB0aGlzLmFjY2Vzc29yaWVzLmZpbHRlcihpdGVtID0+IGl0ZW0uVVVJRCAhPT0gVVVJRCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYWRkR3JvdXBBY2Nlc3NvcnkobGlnaHRHcm91cDogSUdyb3VwTGlzdCkge1xuICAgICAgICB2YXIgYWNjZXNzb3J5ID0gbmV3IHRoaXMuYXBpLnBsYXRmb3JtQWNjZXNzb3J5KGxpZ2h0R3JvdXAuTmFtZSwgbGlnaHRHcm91cC5VVUlEKTtcbiAgICAgICAgbGV0IGNvbnRleHQ6IElDb250ZXh0ID0ge1xuICAgICAgICAgICAgbGFzdERhdGVBZGRlZDogdGhpcy5sYXN0RGF0ZUFkZGVkLFxuICAgICAgICAgICAgY29sb3I6IGxpZ2h0R3JvdXAuQ29sb3IsXG4gICAgICAgICAgICBncm91cE51bWJlcjogbGlnaHRHcm91cC5Hcm91cE51bWJlcixcbiAgICAgICAgICAgIGJyaWdodG5lc3M6IGxpZ2h0R3JvdXAuSW50ZW5zaXR5LFxuICAgICAgICAgICAgdHlwZTogbGlnaHRHcm91cC50eXBlLFxuICAgICAgICAgICAgaXNPbjogbGlnaHRHcm91cC5JbnRlbnNpdHkgPiAwLFxuICAgICAgICAgICAgaW5kZXBlbmRlbnRDb2xvcnM6IHRoaXMuY29uZmlnLmluZGVwZW5kZW50Q29sb3JzLFxuICAgICAgICAgICAgY29tbWFuZFRpbWVvdXQ6IHRoaXMuY29uZmlnLmNvbW1hbmRUaW1lb3V0XG4gICAgICAgIH1cbiAgICAgICAgYWNjZXNzb3J5LmNvbnRleHQgPSBjb250ZXh0O1xuICAgICAgICBMaWdodEZhY3RvcnkuY3JlYXRlTGlnaHQodGhpcywgYWNjZXNzb3J5KTtcbiAgICAgICAgdGhpcy5hcGkucmVnaXN0ZXJQbGF0Zm9ybUFjY2Vzc29yaWVzKFwiaG9tZWJyaWRnZS1sdXhvclwiLCBcIkx1eG9yXCIsIFthY2Nlc3NvcnldKTtcbiAgICB9XG5cbiAgICBhZGRUaGVtZUFjY2Vzc29yeSh0aGVtZUdyb3VwOiBJVGhlbWVMaXN0KSB7XG4gICAgICAgIHZhciBhY2Nlc3NvcnkgPSBuZXcgdGhpcy5hcGkucGxhdGZvcm1BY2Nlc3NvcnkodGhlbWVHcm91cC5OYW1lLCB0aGVtZUdyb3VwLlVVSUQpO1xuICAgICAgICBsZXQgY29udGV4dDogSUNvbnRleHQgPSB7XG4gICAgICAgICAgICBsYXN0RGF0ZUFkZGVkOiB0aGlzLmxhc3REYXRlQWRkZWQsXG4gICAgICAgICAgICB0eXBlOiBJTGlnaHRUeXBlLlRIRU1FLFxuICAgICAgICAgICAgaXNPbjogdGhlbWVHcm91cC5Pbk9mZiA9PT0gMSxcbiAgICAgICAgICAgIHRoZW1lSW5kZXg6IHRoZW1lR3JvdXAuVGhlbWVJbmRleCxcbiAgICAgICAgICAgIE9uT2ZmOiB0aGVtZUdyb3VwLk9uT2ZmLFxuICAgICAgICAgICAgY29tbWFuZFRpbWVvdXQ6IHRoaXMuY29uZmlnLmNvbW1hbmRUaW1lb3V0XG4gICAgICAgIH1cbiAgICAgICAgYWNjZXNzb3J5LmNvbnRleHQgPSBjb250ZXh0O1xuICAgICAgICBMaWdodEZhY3RvcnkuY3JlYXRlTGlnaHQodGhpcywgYWNjZXNzb3J5KTtcbiAgICAgICAgdGhpcy5hY2Nlc3Nvcmllc1thY2Nlc3NvcnkuVVVJRF0gPSBhY2Nlc3Nvcnk7XG4gICAgICAgIHRoaXMuYXBpLnJlZ2lzdGVyUGxhdGZvcm1BY2Nlc3NvcmllcyhcImhvbWVicmlkZ2UtbHV4b3JcIiwgXCJMdXhvclwiLCBbYWNjZXNzb3J5XSk7XG4gICAgfVxuXG4gICAgYXNzaWduVVVJRHMoKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5jdXJyR3JvdXBzQW5kVGhlbWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBsZXQgYWNjID0gdGhpcy5jdXJyR3JvdXBzQW5kVGhlbWVzW2ldO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBhY2MuVGhlbWVJbmRleCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICBhY2MuVVVJRCA9IHRoaXMuYXBpLmhhcC51dWlkLmdlbmVyYXRlKCdsdXhvci4nICsgYHRoZW1lLSR7YWNjLlRoZW1lSW5kZXh9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBhY2MuVVVJRCA9IHRoaXMuYXBpLmhhcC51dWlkLmdlbmVyYXRlKCdsdXhvci4nICsgYGdyb3VwLi0ke2FjYy5Hcm91cE51bWJlcn1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIHByb2Nlc3NBY2Nlc3NvcmllcygpIHtcbiAgICAgICAgdGhpcy5hc3NpZ25VVUlEcygpO1xuICAgICAgICB0aGlzLnJlbW92ZUFjY2Vzc29yaWVzKClcbiAgICAgICAgZm9yICh2YXIgVVVJRCBpbiB0aGlzLmFjY2Vzc29yaWVzKSB7XG4gICAgICAgICAgICBsZXQgY2FjaGVkQWNjID0gdGhpcy5hY2Nlc3Nvcmllc1tVVUlEXTtcbiAgICAgICAgICAgIC8vIGxvb2sgZm9yIG1hdGNoIG9uIGN1cnJlbnQgZGV2aWNlc1xuICAgICAgICAgICAgbGV0IHJlbW92ZSA9IHRydWU7XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHRoaXMuY3Vyckdyb3Vwc0FuZFRoZW1lcy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIGxldCBjdXJyQWNjID0gdGhpcy5jdXJyR3JvdXBzQW5kVGhlbWVzW2pdO1xuICAgICAgICAgICAgICAgIGlmIChjYWNoZWRBY2MuVVVJRCA9PT0gY3VyckFjYy5VVUlEKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGZvdW5kIGV4aXN0aW5nIGRldmljZVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmxvZy5pbmZvKGBMb2FkaW5nIGNhY2hlZCBhY2Nlc3NvcnkgJHtjYWNoZWRBY2MuZGlzcGxheU5hbWV9IHdpdGggVVVJRCAke2NhY2hlZEFjYy5VVUlEfS5gKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gdXBkYXRlIGNhY2hlZCBkZXZpY2UgKG5hbWUsIGV0YylcbiAgICAgICAgICAgICAgICAgICAgbGV0IGNvbnRleHQ6IElDb250ZXh0ID0gY2FjaGVkQWNjLmNvbnRleHQgYXMgSUNvbnRleHQ7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRleHQubGFzdERhdGVBZGRlZCA9IHRoaXMubGFzdERhdGVBZGRlZDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjdXJyQWNjLkNvbG9yICE9PSAndW5kZWZpbmVkJykgY29udGV4dC5jb2xvciA9IGN1cnJBY2MuQ29sb3I7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY3VyckFjYy5Hcm91cE51bWJlciAhPT0gJ3VuZGVmaW5lZCcpIGNvbnRleHQuZ3JvdXBOdW1iZXIgPSBjdXJyQWNjLkdyb3VwTnVtYmVyO1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGN1cnJBY2MuVGhlbWVJbmRleCAhPT0gJ3VuZGVmaW5lZCcpIGNvbnRleHQudGhlbWVJbmRleCA9IGN1cnJBY2MuVGhlbWVJbmRleDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjdXJyQWNjLkludGVuc2l0eSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQuYnJpZ2h0bmVzcyA9IGN1cnJBY2MuSW50ZW5zaXR5O1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dC5pc09uID0gY3VyckFjYy5JbnRlbnNpdHkgPiAwO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY3VyckFjYy50eXBlICE9PSAndW5kZWZpbmVkJykgY29udGV4dC50eXBlID0gY3VyckFjYy50eXBlO1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGN1cnJBY2MuaXNPbiAhPT0gJ3VuZGVmaW5lZCcpIGNvbnRleHQuaXNPbiA9IGN1cnJBY2MuaXNPbjtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjdXJyQWNjLk5hbWUgIT09ICd1bmRlZmluZWQnKSBjYWNoZWRBY2MuZGlzcGxheU5hbWUgPSBjdXJyQWNjLk5hbWU7XG4gICAgICAgICAgICAgICAgICAgIGNhY2hlZEFjYy5jb250ZXh0ID0gY29udGV4dDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hcGkudXBkYXRlUGxhdGZvcm1BY2Nlc3NvcmllcyhbY2FjaGVkQWNjXSk7XG4gICAgICAgICAgICAgICAgICAgIExpZ2h0RmFjdG9yeS5jcmVhdGVMaWdodCh0aGlzLCBjYWNoZWRBY2MpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmN1cnJHcm91cHNBbmRUaGVtZXMuc3BsaWNlKGosIDEpO1xuICAgICAgICAgICAgICAgICAgICByZW1vdmUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gcmVtb3ZlIHRoZSBjYWNoZWRBY2MgdGhhdCBjYW4ndCBiZSBtYXRjaGVkXG4gICAgICAgICAgICBpZiAocmVtb3ZlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5sb2cuaW5mbyhgUmVtb3ZpbmcgY2FjaGVkIGFjY2Vzc29yeSAke2NhY2hlZEFjYy5kaXNwbGF5TmFtZX0gd2l0aCBVVUlEICR7Y2FjaGVkQWNjLlVVSUR9LmApO1xuICAgICAgICAgICAgICAgIHRoaXMuYXBpLnVucmVnaXN0ZXJQbGF0Zm9ybUFjY2Vzc29yaWVzKFwiaG9tZWJyaWRnZS1sdXhvclwiLCBcIkx1eG9yXCIsIFtjYWNoZWRBY2NdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBhZGQgYW55IG5ldyBhY2Nlc3NvcmllcyB0aGF0IHdlcmUgbm90IHByZXZpb3VzbHkgbWF0Y2hlZFxuICAgICAgICBpZiAodGhpcy5jdXJyR3JvdXBzQW5kVGhlbWVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgdGhpcy5jdXJyR3JvdXBzQW5kVGhlbWVzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgbGV0IGN1cnJBY2MgPSB0aGlzLmN1cnJHcm91cHNBbmRUaGVtZXNbal07XG4gICAgICAgICAgICAgICAgdGhpcy5sb2cuaW5mbyhgQWRkaW5nIG5ldyBhY2Nlc3NvcnkgJHtjdXJyQWNjLk5hbWV9IHdpdGggVVVJRCAke2N1cnJBY2MuVVVJRH0uYCk7XG4gICAgICAgICAgICAgICAgaWYgKGN1cnJBY2MudHlwZSA9PT0gSUxpZ2h0VHlwZS5USEVNRSlcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hZGRUaGVtZUFjY2Vzc29yeShjdXJyQWNjKTtcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkR3JvdXBBY2Nlc3NvcnkoY3VyckFjYyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBkaWRGaW5pc2hMYXVuY2hpbmdBc3luYygpIHtcbiAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5pcEFkZHIpIHtcbiAgICAgICAgICAgIHRoaXMubG9nLmVycm9yKHRoaXMuTmFtZSArIFwiIG5lZWRzIGFuIElQIEFkZHJlc3MgaW4gdGhlIGNvbmZpZyBmaWxlLiAgUGxlYXNlIHNlZSBzYW1wbGVfY29uZmlnLmpzb24uXCIpO1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsZXQgaXNDb25uZWN0ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHdoaWxlICghaXNDb25uZWN0ZWQpe1xuICAgICAgICAgICAgICAgIGlzQ29ubmVjdGVkID0gYXdhaXQgdGhpcy5nZXRDb250cm9sbGVyQXN5bmMoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmxvZy5pbmZvKGBVbmFibGUgdG8gY29ubmVjdCB0byBMdXhvciBjb250cm9sbGVyLiAgV2FpdGluZyA2MHMgYW5kIHdpbGwgcmV0cnkuYClcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDYwKjEwMDApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy90aGlzLnJldHJpZXZlQ2FjaGVkQWNjZXNzb3JpZXMoKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuZ2V0Q29udHJvbGxlckdyb3VwTGlzdEFzeW5jKCk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmdldENvbnRyb2xsZXJUaGVtZUxpc3RBc3luYygpO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wcm9jZXNzQWNjZXNzb3JpZXMoKTtcbiAgICAgICAgICAgIC8vIHRoaXMucmVtb3ZlT3BoYW5lZEFjY2Vzc29yaWVzKCk7XG4gICAgICAgICAgICB0aGlzLmxvZy5pbmZvKCdGaW5pc2hlZCBpbml0aWFsaXppbmcnKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICB0aGlzLmxvZy5lcnJvcignRXJyb3IgaW4gZGlkRmluaXNoTGF1bmNoaW5nJywgZXJyKTtcbiAgICAgICAgfTtcbiAgICB9XG59XG5leHBvcnQgaW50ZXJmYWNlIElDb250ZXh0IHtcbiAgICBsYXN0RGF0ZUFkZGVkOiBudW1iZXI7XG4gICAgZ3JvdXBOdW1iZXI/OiBudW1iZXI7XG4gICAgYnJpZ2h0bmVzcz86IG51bWJlcjtcbiAgICB0eXBlOiBJTGlnaHRUeXBlXG4gICAgY29sb3I/OiBudW1iZXI7XG4gICAgc3RhdHVzPzogYW55O1xuICAgIGlzT246IGJvb2xlYW47XG4gICAgaHVlPzogbnVtYmVyO1xuICAgIHNhdHVyYXRpb24/OiBudW1iZXI7XG4gICAgdGhlbWVJbmRleD86IG51bWJlcjtcbiAgICBPbk9mZj86IDAgfCAxO1xuICAgIGluZGVwZW5kZW50Q29sb3JzPzogYm9vbGVhbjtcbiAgICBjb21tYW5kVGltZW91dDogbnVtYmVyO1xufSJdfQ==