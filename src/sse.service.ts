import { Readable } from 'stream';
import { curry, generateId } from './utils';
import { HttpResponse, HttpRequest, HttpResponseHeaders } from './sse.interface';
import { SSEClientObjInterface } from './sse.interface';

const DEFAULT_GROUP = 'defaultSSEGroup';

const clientsMap: {
  [group: string]: {
    [id: string]: SSEClientObjInterface;
  };
} = { [DEFAULT_GROUP]: {} };

const _generateEvent = (msg: string | Record<any, any> | any[], eventType?: string, id?: number) => {
  const event = {
    ...(eventType && { event: eventType }),
    ...(id && { id }),
    data: typeof msg === 'string' ? msg : JSON.stringify(msg)
  };
  const endl = '\n';
  let ret = '';

  Object.keys(event).forEach((key) => {
    ret = `${ret}${key}:${event[key]}${endl}`;
  });

  return `${ret}${endl}`;
};

const _pipeSSEMessageToResponse = (event: string, connection: HttpResponse) => {
  const readable = Readable.from(event);
  readable.pipe(connection, { end: false });

  readable.on('data', () => {
    if (connection.flushHeaders && event.match(/\n\n$/)) {
      connection.flushHeaders();
    }
  });

  readable.on('error', (err) => {
    console.log(`Write sse got error: ${err.message}`);
    throw err;
  });
};

const sendSSEToConnection = (
  connection: HttpResponse,
  msg: string | Record<any, any> | any[],
  eventType?: string,
  sseMsgId?: number
): void => {
  const event = _generateEvent(msg, eventType, sseMsgId);
  _pipeSSEMessageToResponse(event, connection);
};

const getClientObj = (clientId: string, groupName = DEFAULT_GROUP): SSEClientObjInterface | undefined => {
  const client = clientsMap[groupName][clientId];
  if (!client) {
    console.log(`No client with id: ${clientId}`);
    return;
  }

  return client;
};

const sendSSEToClient: (
  clientId?: string,
  msg?: string | Record<any, any> | any[],
  eventType?: string,
  groupName?: string,
  sseMsgId?: number,
) => void = curry(
  (clientId: string, msg: string | Record<any, any> | any[], eventType = 'message', groupName = DEFAULT_GROUP, sseMsgId?: number) => {
    try {
      const client = getClientObj(clientId, groupName);

      if (client) {
        const event = _generateEvent(msg, eventType, sseMsgId);
        client.connections.forEach((connection) => {
          _pipeSSEMessageToResponse(event, connection);
        });
      }
    } catch (e) {
      console.log(`Write sse got error: ${e.message}`);
      throw e;
    }
  }
);

const sendSSEToAll = (msg: string | Record<any, any> | any[], eventType?: string, groupName = DEFAULT_GROUP, sseMsgId?: number) => {
  if (!Object.keys(clientsMap[groupName]).length) {
    return;
  }
  const event = _generateEvent(msg, eventType, sseMsgId);
  Object.keys(clientsMap[groupName]).forEach((clientId) => {
    try {
      const client = getClientObj(clientId, groupName);

      if (client) {
        client.connections.forEach((connection) => {
          _pipeSSEMessageToResponse(event, connection);
        });
      }
    } catch (e) {
      console.log(`Error while sending SSE to client with id: ${clientId}: ${e.message}`);
    }
  });
};

const connectSSE = ({
  req,
  res,
  originalResHeaders,
  meta = {},
  clientId,
  onDisconnectCb,
  groupName = DEFAULT_GROUP
}: {
  req: HttpRequest;
  res: HttpResponse;
  originalResHeaders: HttpResponseHeaders;
  meta?: Record<string, any>;
  clientId?: string;
  onDisconnectCb?: () => void;
  groupName?: string;
}): { client: SSEClientObjInterface; currConnection: HttpResponse } => {
  const SSE_RESPONSE_HEADER = {
    Connection: 'keep-alive',
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no'
  };
  // setMaxListeners in case of big messages sse, because previous pipes can be not released yet
  res.setMaxListeners(50);
  res.writeHead(200, Object.assign(originalResHeaders, SSE_RESPONSE_HEADER));

  const clId = clientId || generateId();

  if (!clientsMap[groupName]) {
    clientsMap[groupName] = {};
  }

  if (clientsMap[groupName][clId]) {
    console.log(`New sse connection for client with id ${clId}.`);
    clientsMap[groupName][clId].connections.push(res);
  } else {
    console.log(`New sse client with id ${clId}.`);
    clientsMap[groupName][clId] = {
      meta,
      clientId: clId,
      connections: [res]
    };
  }

  res.write(`\n`);

  // keep the connection open by sending a comment
  const keepAlive = setInterval(() => {
    const keepAliveEvent = _generateEvent(`:keep-alive`);
    res.write(keepAliveEvent);
  }, 20 * 1000);

  req.on('close', () => {
    clearInterval(keepAlive);
    if (clientsMap[groupName][clId]) {
      clientsMap[groupName][clId] = Object.assign(clientsMap[groupName][clId], {
        connections: clientsMap[groupName][clId].connections.filter((connection) => res !== connection)
      });
      if (!clientsMap[groupName][clId].connections.length) {
        console.log(`Client with id ${clId} disconnected and deleted from sse.`);
        delete clientsMap[groupName][clId];
      }
    }
    if (onDisconnectCb) {
      onDisconnectCb();
    }
  });

  return { client: clientsMap[groupName][clId], currConnection: res };
};

const getAllClientObjs = (groupName = DEFAULT_GROUP): SSEClientObjInterface[] | void => {
  const clientsObjs = Object.values(clientsMap[groupName]);
  if (!clientsObjs.length) {
    return;
  }
  return clientsObjs;
};

const setClientMetadata: (
  clientId: string,
  meta: Record<string, any>,
  groupName: string
) => SSEClientObjInterface | void = curry(
  (clientId: string, meta: Record<string, any>, groupName = DEFAULT_GROUP): SSEClientObjInterface | void => {
    const client = clientsMap[groupName][clientId];
    if (!client) {
      console.log(`No client with id: ${clientId}`);
      return;
    }
    client.meta = meta;

    return client;
  }
);

export {
  sendSSEToClient,
  sendSSEToConnection,
  sendSSEToAll,
  connectSSE,
  getClientObj,
  getAllClientObjs,
  setClientMetadata
};
