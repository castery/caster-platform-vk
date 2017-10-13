import { assert, expect } from 'chai';

import { Queue } from '../queue';

const { NODE_ENV = 'development' } = process.env;

describe('Queue', () => {
	it('should return a promise when adding to the queue', () => {
		const queue = new Queue();

		const result = queue.enqueue({
			peer_id: 1234,
			message: 'TEST'
		});

		if (!(result instanceof Promise)) {
			throw new Error('The return value is not a promise');
		}
	});

	it('text messages should be combined', () => {
		const queue = new Queue();

		const otherPeer = 391;
		const inPeer = 7071;

		queue.enqueue({
			peer_id: inPeer,
			message: 'combined'
		});

		queue.enqueue({
			peer_id: otherPeer,
			message: 'other'
		});

		queue.enqueue({
			peer_id: inPeer,
			message: 'message'
		});

		const message = queue.dequeue();

		expect(message.message).to.equal('combined\n\nmessage');

		expect(message.peer_id).to.equal(inPeer);
	});

	it('unique text messages should not be combined', () => {
		const queue = new Queue();

		const otherPeer = 391;
		const inPeer = 7071;

		queue.enqueue({
			peer_id: inPeer,
			message: 'combined'
		});

		queue.enqueue({
			peer_id: otherPeer,
			message: 'other'
		});

		queue.enqueue({
			peer_id: inPeer,
			message: 'message',
			attachment: 'doc123_456'
		});

		const firstMessage = queue.dequeue();

		queue.dequeue();

		const lastMessage = queue.dequeue();

		expect(firstMessage.message).to.equal('combined');
		expect(firstMessage.peer_id).to.equal(inPeer);

		expect(lastMessage.message).to.equal('message');
		expect(lastMessage.peer_id).to.equal(inPeer);
	});

	it('combined messages must return the same result', () => {
		const queue = new Queue();

		const otherPeer = 391;
		const inPeer = 7071;

		const promises = [
			queue.enqueue({
				peer_id: inPeer,
				message: 'combined'
			}),
			queue.enqueue({
				peer_id: otherPeer,
				message: 'other'
			}),
			queue.enqueue({
				peer_id: inPeer,
				message: 'message'
			})
		];

		for (const resolve of queue.dequeue().promise.resolve) {
			resolve(inPeer);
		}

		queue.dequeue().promise.resolve[0](otherPeer);

		return Promise.all(promises)
			.then((result) => {
				expect(result).to.deep.equal([inPeer, otherPeer, inPeer]);
			});
	});

	it('The queue must clear messages by destination ID and reject promise', () => {
		const queue = new Queue();

		const otherPeer = 391;
		const inPeer = 7071;

		const promises = [
			queue.enqueue({
				peer_id: inPeer,
				message: 'combined'
			})
				.then(() => false)
				.catch(() => true),
			queue.enqueue({
				peer_id: otherPeer,
				message: 'other'
			})
				.then(() => true)
				.catch(() => false),
			queue.enqueue({
				peer_id: inPeer,
				message: 'message'
			})
				.then(() => false)
				.catch(() => true)
		];

		queue.clearByPeer(inPeer);

		const otherMessage = queue.dequeue();

		if (otherMessage.peer_id !== otherPeer || queue.length !== 0) {
			throw new Error('There should be only another message left');
		}

		otherMessage.promise.resolve[0]();

		return Promise.all(promises)
			.then((result) => {
				expect(result).to.deep.equal([true, true, true]);
			});
	});

	it('enqueue should return null in empty queue', () => {
		const queue = new Queue();

		expect(queue.dequeue()).to.be.null();
	});

	it('isEmpty should return true in empty queue', () => {
		const queue = new Queue();

		expect(queue.isEmpty()).to.be.true();
	});
});
