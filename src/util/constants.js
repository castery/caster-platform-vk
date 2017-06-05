'use strict';

import Joi from 'joi';

/**
 * Platform context name
 *
 * @type {string}
 */
export const PLATFORM_NAME = 'vk';

/**
 * Default options platform
 *
 * @type {Object}
 * @property {boolean} [isGroup]
 * @property {number}  [sendingInterval] Interval send message
 */
export const defaultOptions = {
	id: null,

	adapter: {},

	isGroup: false,
	sendingInterval: 1800
};

/**
 * Default options platform schema
 *
 * @type {Object}
 *
 * @extends {defaultOptions}
 */
export const defaultOptionsSchema = Joi.object().keys({
	id: Joi.number().allow(null),

	adapter: Joi.object(),

	isGroup: Joi.boolean(),
	sendingInterval: Joi.number().min(100)
});
