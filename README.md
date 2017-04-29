<p align="center">
<a href="https://travis-ci.org/castery/caster-vk"><img src="https://img.shields.io/travis/castery/caster-vk.svg?style=flat-square" alt="Build Status"></a>
<a href="https://www.npmjs.com/@castery/caster-vk"><img src="https://img.shields.io/npm/v/@castery/caster-vk.svg?style=flat-square" alt="NPM version"></a>
<a href="https://www.npmjs.com/package/@castery/caster-vk"><img src="https://img.shields.io/npm/dt/@castery/caster-vk.svg?style=flat-square" alt="NPM downloads"></a>
</p>

🤖 This is the official platform integration module for [caster](https://github.com/castery/caster). This platform was created for the social network [VK](https://vk.com)

| 🤖 [Caster](https://github.com/castery/caster) | 📖 [Documentation](docs/) |
|------------------------------------------------|----------------------------|

## Installation
**[Node.js](https://nodejs.org/) 7.0.0 or newer is required**  
### NPM
```shell
npm install @castery/caster-vk --save
```
### Yarn
```shell
yarn add @castery/caster-vk
```

## Usage
```js
import { VKPlatform } from '@castery/caster-vk';

/* ... */

const vk = new VKPlatform({
	adapter: {
		token: '<token>'
	}
});

caster.use(vk);
```
