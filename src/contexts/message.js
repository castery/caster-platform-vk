import { MessageContext, CONTEXT_PROPS } from '@castery/caster';

import {
	PLATFORM_NAME,
	supportedContextTypes,
	supportedAttachmentTypes
} from '../util/constants';

const { SUPPORTED_CONTEXT_TYPES, SUPPORTED_ATTACHMENT_TYPES } = CONTEXT_PROPS;

/**
 * Incoming vk context
 *
 * @public
 */
export default class VKMessageContext extends MessageContext {
	/**
	 * Constructor
	 *
	 * @param {Caster}  caster
	 * @param {Message} message
	 * @param {number}  id
	 */
	constructor(caster, { id, message, $text = null }) {
		super(caster);

		this.platform = {
			id,
			name: PLATFORM_NAME
		};

		this.text = message.text;
		this.$text = $text;

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
	 * Returns supported context types
	 *
	 * @return {Object}
	 */
	get [SUPPORTED_CONTEXT_TYPES]() {
		return supportedContextTypes;
	}

	/**
	 * Returns supported attachment types
	 *
	 * @return {Object}
	 */
	get [SUPPORTED_ATTACHMENT_TYPES]() {
		return supportedAttachmentTypes;
	}

	/**
	 * Sends a message to the current dialog
	 *
	 * @param {mixed}  text
	 * @param {Object} options
	 *
	 * @return {Promise<mixed>}
	 */
	send(text, options = {}) {
		if (typeof text === 'object') {
			options = text;
		} else {
			options.text = text;
		}

		const message = new VKMessageContext(this.caster, {
			id: this.platform.id,
			message: this.raw
		});

		message.to = this.from;
		message.text = options.text;

		if ('attachments' in options) {
			if (!Array.isArray(options.attachments)) {
				options.attachments = [options.attachments];
			} else {
				message.attachments = options.attachments;
			}
		}

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
	reply(text, options = {}) {
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
