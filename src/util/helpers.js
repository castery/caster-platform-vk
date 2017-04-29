'use strict';

const CHAT_PEER = 2e9;

/**
 * Converts parameters to peer_id
 *
 * @param {Object} message
 */
export const convertToPeer = (message) => {
	const { chat_id: chatId, user_id: userId } = message;

	delete message.chat_id;
	delete message.user_id;

	if ('peer_id' in message) {
		return;
	}

	if (chatId !== undefined) {
		message.peer_id = CHAT_PEER + chatId;

		return;
	}

	if (userId !== undefined) {
		message.peer_id = userId;

		return;
	}

	throw new Error('Missing destination ID');
};

/**
 * Checks message for uniqueness
 *
 * @param {Object} params
 *
 * @return {boolean}
 */
export const isSpecialMessage = (params) => (
	'attachment' in params
	|| 'forward_messages' in params
	|| 'sticker_id' in params
);
