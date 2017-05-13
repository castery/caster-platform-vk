'use strict';

import { PLATFORM } from '../util/constants';

/* TODO: Change from local package to npm */
import { MessageContext } from '../../../caster';

/**
 * Incoming vk context
 *
 * @public
 */
export class VKMessageContext extends MessageContext {
	/**
	 * Constructor
	 *
	 * @param {VKPlatform} platform
	 * @param {Caster}     caster
	 * @param {Message}    message
	 * @param {string}     type
	 */
	constructor (platform, caster,  message) {
		super(caster);

		this.platform = {
			id: platform.options.id,
			name: PLATFORM
		};

		this.text = message.text;

		this.from = {
			id: message.peer,
			type: message.from
		};

		if (message.from === 'group') {
			this.sender = {
				id: -message.peer,
				type: 'group'
			};
		} else {
			this.sender = {
				id: message.user,
				type: 'user'
			};
		}

		this.raw = message;

		this._platform = platform;
	}

	/**
	 * Sends a message to the current dialog
	 *
	 * @param {mixed}  text
	 * @param {Object} options
	 *
	 * @return {Promise<mixed>}
	 */
	send (text, options = {}) {
		if (typeof text === 'object') {
			options = text;
		} else {
			options.text = text;
		}

		options._from = this.from;

		return this._platform.send(options);
	}

	/**
	 * Responds to a message with a mention
	 *
	 * @param {mixed}  text
	 * @param {Object} options
	 *
	 * @return {Promise<mixed>}
	 */
	reply (text, options = {}) {
		if (typeof text === 'object') {
			options = text;
		} else {
			options.text = text;
		}

		// TODO: Add user name
		options.text = `@id${this.sender.id}, ${options.text}`;

		return this.send(options);
	}
}
