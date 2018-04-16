import * as Joi from 'joi';

import { MessageContext } from '@castery/caster';

/**
 * Platform context name
 *
 * @type {string}
 */
export const PLATFORM_NAME = 'vk';

/**
 * Supported platform types
 *
 * @type {Object}
 */
export const supportedContextTypes = MessageContext.defaultSupportedContextTypes({
	message: true
});

/**
 * Supported platform attachments
 *
 * @type {Object}
 */
export const supportedAttachmentTypes = MessageContext.defaultSupportedAttachmentTypes({
	voice: true,
	image: true,
	audio: true,
	video: true,
	document: true
});

/**
 * Switches type attachments
 *
 * @type {Object}
 */
export const switchAttachments = {
	image: 'photo',
	document: 'doc'
};

export const switchUploadMethod = {
	image: 'messagePhoto',
	document: 'messageDoc'
};

/**
 * Default options platform
 *
 * @type {Object}
 *
 * @property {mixed}   [id]              Unique ID platform
 * @property {Object}  [adapter]         Options for adapter
 * @property {array}   [prefix]          Message prefix not for group
 * @property {boolean} [isGroup]         Requests optimization for group
 * @property {boolean} [combineMessages] Combine messages
 * @property {number}  [sendingInterval] Interval send message
 */
export const defaultOptions = {
	id: null,

	adapter: {},

	prefix: ['Bot'],

	isGroup: false,
	combineMessages: false,
	sendingInterval: 1800
};

/**
 * Default options platform schema
 *
 * @type {Object}
 */
export const defaultOptionsSchema = Joi.object().keys({
	id: Joi.number().allow(null),

	adapter: Joi.object(),

	prefix: Joi.array(),

	isGroup: Joi.boolean(),
	combineMessages: Joi.boolean(),
	sendingInterval: Joi.number().min(100)
});
