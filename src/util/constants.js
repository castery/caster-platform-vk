'use strict';

import Joi from 'joi';

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
	image: true,
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
	image: 'message',
	document: 'doc'
};

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
