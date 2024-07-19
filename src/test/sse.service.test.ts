import http from 'http';
import EventSource from 'eventsource';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { createHttpServer, closeServer, getUrl } from './utils/http';
import { connectSSE, getClientObj, sendSSEToClient } from '../sse.service';

let url: string;
let server: http.Server;
let eventSource: EventSource;

beforeEach(async () => {
  server = await createHttpServer();
  url = getUrl(server);
});

afterEach(async () => {
    if (eventSource) {
        eventSource.close();
    }
    await closeServer(server);
});

describe('Session', () => {
    it('can establish connection', async () => {
        return new Promise((done) => {
            server.on('request', (req, res) => {
                const sseSession = connectSSE({
                    req,
                    res,
                    originalResHeaders: req.headers
                });

                expect(sseSession.currConnection).toBeDefined();
                expect(sseSession.client).toBeDefined();
                expect(sseSession.client.connections.length).toEqual(1);

                done(null);

            });

            eventSource = new EventSource(url);
        });
    });

    it('can establish multiple connections per user with the same id', async () => {

        const clientId = 'unique-client-id';
        let sseSession;

        let eventSource1;
        let eventSource2;

        await new Promise((done) => {
            server.once('request', async (req, res) => {
                sseSession = connectSSE({
                    req,
                    res,
                    originalResHeaders: req.headers,
                    clientId,
                });
                done(null);
            });
            eventSource1 = new EventSource(url);
        });

        await new Promise((done) => {
            server.once('request', async (req, res) => {
                connectSSE({
                    req,
                    res,
                    originalResHeaders: req.headers,
                    clientId,
                });
                done(null);
            });
            eventSource2 = new EventSource(url);

        });

        expect(sseSession.client.connections.length).toEqual(2);
        expect(getClientObj(clientId)).toBeDefined();
        expect(getClientObj(clientId)?.connections.length).toEqual(2);
        eventSource1.close();
        eventSource2.close();
    });


    it('can establish connection within group', async () => {
        const groupName = 'unique-group-name';
        const clientId = 'unique-client-id';



        await new Promise((done) => {
            server.on('request', async (req, res) => {
                connectSSE({
                    req,
                    res,
                    originalResHeaders: req.headers,
                    clientId,
                    groupName,
                });
                done(null);
            });

            eventSource = new EventSource(url);
        });

        expect(getClientObj(clientId, groupName)).toBeDefined();
        expect(getClientObj(clientId, groupName)?.connections.length).toEqual(1);
    });

    it('send and received message', async () => {
        const clientId = 'unique-client-id';
        const data = 'dataMessage'
        const messageType = 'testType'

        let receivedData = '';

        await new Promise((done) => {
            server.on('request', (req, res) => {
                eventSource.addEventListener('open', () => {
                    eventSource.addEventListener(messageType, (event) => {
                        receivedData = event.data;
                        done(null);
                    });
                    sendSSEToClient(clientId, data, messageType);
                });
                connectSSE({
                    req,
                    res,
                    originalResHeaders: req.headers,
                    clientId,
                });
            });

            eventSource = new EventSource(url);
        });

        expect(receivedData).toEqual(data);
    });
});
