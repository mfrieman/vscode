/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as assert from 'assert';
import { TPromise } from 'vs/base/common/winjs.base';
import { Client } from 'vs/base/parts/ipc/node/ipc.cp';
import { always } from 'vs/base/common/async';
import { isPromiseCanceledError } from 'vs/base/common/errors';
import { ITestChannel, TestServiceClient } from './testService';
import { getPathFromAmdModule } from 'vs/base/common/amd';

function createClient(): Client {
	return new Client(getPathFromAmdModule(require, 'bootstrap-fork'), {
		serverName: 'TestServer',
		env: { AMD_ENTRYPOINT: 'vs/base/parts/ipc/test/node/testApp', verbose: true }
	});
}

suite('IPC, Child Process', () => {
	test('createChannel', () => {
		const client = createClient();
		const channel = client.getChannel<ITestChannel>('test');
		const service = new TestServiceClient(channel);

		const result = service.pong('ping').then(r => {
			assert.equal(r.incoming, 'ping');
			assert.equal(r.outgoing, 'pong');
		});

		return always(result, () => client.dispose());
	});

	test('cancellation', () => {
		const client = createClient();
		const channel = client.getChannel<ITestChannel>('test');
		const service = new TestServiceClient(channel);
		const res = service.cancelMe();

		setTimeout(() => res.cancel(), 50);

		const result = res.then(
			() => assert.fail('Unexpected'),
			err => assert.ok(err && isPromiseCanceledError(err))
		);

		return always(result, () => client.dispose());
	});

	test('events', () => {
		const client = createClient();
		const channel = client.getChannel<ITestChannel>('test');
		const service = new TestServiceClient(channel);

		const event = new TPromise((c, e) => {
			service.onMarco(({ answer }) => {
				try {
					assert.equal(answer, 'polo');
					c(null);
				} catch (err) {
					e(err);
				}
			});
		});

		const request = service.marco();
		const result = TPromise.join<any>([request, event]);

		return always(result, () => client.dispose());
	});

	test('event dispose', () => {
		const client = createClient();
		const channel = client.getChannel<ITestChannel>('test');
		const service = new TestServiceClient(channel);

		let count = 0;
		const disposable = service.onMarco(() => count++);

		const result = service.marco().then(answer => {
			assert.equal(answer, 'polo');
			assert.equal(count, 1);

			return service.marco().then(answer => {
				assert.equal(answer, 'polo');
				assert.equal(count, 2);
				disposable.dispose();

				return service.marco().then(answer => {
					assert.equal(answer, 'polo');
					assert.equal(count, 2);
				});
			});
		});

		return always(result, () => client.dispose());
	});
});
