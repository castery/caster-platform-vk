'use strict';

import { PLATFORM_NAME } from '../util/constants';

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
	 * @param {Caster}  caster
	 * @param {Message} message
	 * @param {number}  id
	 */
	constructor (caster, message, id) {
		super(caster);

		this.platform = {
			id,
			name: PLATFORM_NAME
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

		const message = new VKMessageContext(this.caster, this.raw, this.platform.id);

		message.to = this.from;
		message.text = options.text;

		return this.caster.dispatchOutcoming(message);
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
