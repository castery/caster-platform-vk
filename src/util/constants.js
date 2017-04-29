'use strict';

import Joi from 'joi';

/**
 * Platform context name
 *
 * @type {string}
 */
export const PLATFORM = 'vk';

/**
 * Default options platform
 *
 * @type {Object}
 * @property {boolean} [isGroup]
 * @property {number}  [sendingInterval] Interval send message
 */
export const defaultOptions = {
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
	adapter: Joi.object(),

	isGroup: Joi.boolean(),
	sendingInterval: Joi.number().min(100)
});
