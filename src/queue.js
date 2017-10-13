import { isSpecialMessage } from './util/helpers';

/**
 * A queue for messages with a combination of text messages
 *
 * @private
 */
export default class Queue {
	/**
	 * Constructor
	 */
	constructor() {
		this.queue = [];
	}

	/**
	 * Returns the length of the queue
	 *
	 * @return {number}
	 */
	get length() {
		return this.queue.length;
	}

	/**
	 * Checks if the queue is empty
	 *
	 * @return {boolean}
	 */
	isEmpty() {
		return this.queue.length === 0;
	}

	/**
	 * Processes a message for the queue
	 *
	 * @param {Object} params
	 *
	 * @return {Promise<mixed>}
	 */
	enqueue(params) {
		return new Promise((resolve, reject) => {
			if (isSpecialMessage(params)) {
				this.enqueuePush(params, resolve, reject);

				return;
			}

			const { peer_id: peer } = params;

			for (const queued of this.queue) {
				if (queued.peer_id !== peer || isSpecialMessage(queued)) {
					continue;
				}

				queued.message += `\n\n${params.message}`;

				queued.promise.resolve.push(resolve);
				queued.promise.reject.push(reject);

				break;
			}

			this.enqueuePush(params, resolve, reject);
		});
	}

	/**
	 * Returns a message from the queue
	 *
	 * @return {?Object}
	 */
	dequeue() {
		return this.queue.shift() || null;
	}

	/**
	 * Clears messages by destination ID
	 *
	 * @param {number} peer
	 */
	clearByPeer(peer) {
		const error = new Error(`Purge the queue for the destination ID ${peer}`);

		for (let i = 0; i < this.queue.length; i += 1) {
			if (this.queue[i].peer_id !== peer) {
				continue;
			}

			const message = this.queue.splice(i, 1)[0];

			/* We return one position back */
			i -= 1;

			for (const reject of message.promise.reject) {
				reject(error);
			}
		}
	}

	/**
	 * Adds a message to the queue
	 *
	 * @param {Object}   params
	 * @param {function} resolve
	 * @param {function} reject
	 */
	enqueuePush(params, resolve, reject) {
		params.promise = {
			resolve: [resolve],
			reject: [reject]
		};

		this.queue.push(params);
	}
}
