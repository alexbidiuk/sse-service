# SSE service
## _Lightweight, fast and framework-agnostic sse service for NodeJS_

Written on TS.
## Features

- Could be embedded to Express, Fastify, Nest, etc. implemantation
- Easy to manage connections by providing a groups feature of user conections
- Allows a few connections per user (from different devices for example), so you can send data to every user connection providing the user id
- Allows to pass through original response headers(headers that were added by your framework, for example) to end up response stream

## Basic usages examples

### _Fastify_

```typescript

import { SSEClientObjInterface } from 'sse-service';
import { fastify } from 'fastify';

const server = fastify({ logger: true });

server.route({
  method: 'GET',
  url: '/sse',
  handler: async (req, res) => {
    sse.connectSSE({
      clientId: 'unique id', // this is a primary key of how your client connection could be retrieved, could be ommited, library will take care of creating unique id  
      // client id could be retrieved from the JWT token for example
      req: req.raw, // here we link to raw NodeJS request object, because its wrapped by Fastify
      res: res.raw, // the same as for request
      originalResHeaders: res.getHeaders(), // sometimes you need to pass through response headers added by Fastify, this headers will be added to raw NodeJS response stream
      onDisconnectCb: () => {
        // ....
      }, // sometimes you need to perform some actions when user disconnects
    });
  },
});

```
#### Then you can use it like this in some service where you receive updates from the db for example:

```typescript
// someService.ts

import { sendSSEToClient } from 'sse-service';

// ....

// some function that handles update from DB or whatever
const processUpdate = (update) => {
  const { userId, ...payload } = update;
  
  sendSSEToClient(userId, payload); // this will send payload to every connection that user with userId has
  
  // OR send update to all:

  sendSSEToAll(payload);
}; 



```

### _Nest_

_Take a note that Nest has built-in SSE implementation:_ https://docs.nestjs.com/techniques/server-sent-events

_So maybe for you goals it will be enough using it_ 

```typescript
// sse.controller.ts

import { connectSSE } from 'sse-service';

// ...

export class SseController {

    // ...
  
    public sse(@Req() req, @Res() res) {
      connectSSE({
        clientId: req.user.id, // this is a primary key of how your client connection could be retrieved, could be ommited, library will take care of creating unique id  
        // client id could be retrieved from the JWT token for example
        req,
        res,
        originalResHeaders: res.getHeaders(), // sometimes you need to pass through response headers added by Nest (actually it is Fastify or Express under the hood), this headers will be added to raw NodeJS response stream
        onDisconnectCb: () => {
          // ... 
        }, // sometimes you need to perform some actions when user disconnects
      });
    }
}

```
#### Then you can use it like this in some service where you receive updates from the db for example:

```typescript
// someService.ts

import { sendSSEToClient } from 'sse-service';

// ....

// some function that handles update from DB or whatever
const processUpdate = (update) => {
  const { userId, ...payload } = update;
  
  sendSSEToClient(userId, payload); // this will send payload to every connection that user with userId has

  // OR send update to all:

  sendSSEToAll(payload);
}; 


```

### _Express_

```javascript
var express = require('express')
var app = express()

app.get('/sse', function (req, res) {
  connectSSE({
    clientId: req.user.id, // this is a primary key of how your client connection could be retrieved, could be ommited, library will take care of creating unique id  
    // client id could be retrieved from the JWT token for example
    req,
    res,
    originalResHeaders: res.getHeaders(), // sometimes you need to pass through response headers added by Express, this headers will be added to raw NodeJS response stream
    onDisconnectCb: () => {
      // ... 
    }, // sometimes you need to perform some actions when user disconnects
  });
})

app.listen(3000);
```

#### Then you can use it like this in some service where you receive updates from the db for example:

```typescript
// someService.ts

import { sendSSEToClient } from 'sse-service';

// ....

// some function that handles update from DB or whatever
const processUpdate = (update) => {
  const { userId, ...payload } = update;
  
  sendSSEToClient(userId, payload); // this will send payload to every connection that user with userId has

  // OR send update to all:

  sendSSEToAll(payload);
}; 


```

## Installation

```sh
npm install sse-service
```

## API 

### connectSSE(params)

Setups SSE connection

params:
```

{
  req: HttpRequest; // NodeJS raw request object
  
  res: HttpResponse; // NodeJS raw response object
  
  originalResHeaders: HttpResponseHeaders; // response headers from the response object of you framework,
  // for example Fastify wraps original response object and could add additional headers,
  // so if you want to pass them through call .getHeaders() on the framework's response object and pass here 
  
  meta?: Record<string, any>; // any metadata to be persisted in client object that will be created 
  
  clientId?: string; // this is a primary key of how your client connection could be retrieved, 
  // could be ommited, library will take care of creating unique id  
  // client id could be retrieved from the JWT token for example
  
  onDisconnectCb?: () => void; // sometimes you need to perform some actions when user disconnects
  
  groupName?: string; // this param allows you to add this user connection to some specific group(namespace)
  // so later you could send a SSE message for all users connections from this group
  // by default all connections being added to default group name
}

```

Method returns: 

```

 {
    client: {
        connections: HttpResponse[]; // array of raw NodeJS responses, 
        // will contain more then one if we add few connections by the same clientId param
        meta?: Record<string, any>; // any meta you have added by meta param
        clientId: string; // client id you passed to or the one generated by lib
    };
    currConnection: HttpResponse // raw NodeJS response object that was esatablished by this specific connectSSE method call 
 }
 
```

### sendSSEToClient(clientId, msg [, eventType [, groupName [, sseMsgId ] ] ])

Send message to specific client by id 

Params:

| Param        |                                   Type/Required                                   |                                                                                                                                                                                                 Comment |
|:-------------|:---------------------------------------------------------------------------------:|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|
| clientId     |                     _Type_: **string** <br/> _Required_: true                     |                                                                                                                                                               Id of the client you want send message to |
| msg          | _Type_: **string** or **Record<string, any>** or **any[]** <br/> _Required_: true |                                                                                                                                                                                         Message to send |
| eventType    |                    _Type_: **string** <br/> _Required_: false                     |                                                                    Event type param in SSE message, check: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events |
| groupName    |                    _Type_: **string** <br/> _Required_: false                     |                                                                                                      The group(namespace) where to get this client by id from, if not provided it goes to default group |
| sseMsgId     |                    _Type_: **number** <br/> _Required_: false                     |                                   The event ID to set the EventSource object's last event ID value, check: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events |


### sendSSEToConnection(connection, msg [, eventType [, sseMsgId ] ])

Send message to specific connection

Params:

| Param         |                                     Type/Required                                      |                                                                                                                                                               Comment |
|:--------------|:--------------------------------------------------------------------------------------:|----------------------------------------------------------------------------------------------------------------------------------------------------------------------:|
| connection    |          _Type_: **HttpResponse** <br/> _Required_: true                               |                                                                                                                          Response object that was established for SSE |
| msg           |   _Type_: **string** or **Record<string, any>** or **any[]** <br/> _Required_: true    |                                                                                                                                                       Message to send |
| eventType     |                       _Type_: **string** <br/> _Required_: false                       |                                  Event type param in SSE message, check: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events |
| sseMsgId      |                       _Type_: **number** <br/> _Required_: false                       | The event ID to set the EventSource object's last event ID value, check: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events |

### sendSSEToAll(connection, msg [, eventType [, sseMsgId ] ])

Send message to all active clients

Params:

| Param        |                                   Type/Required                                   |                                                                                                                                                                                                 Comment |
|:-------------|:---------------------------------------------------------------------------------:|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|
| msg          | _Type_: **string** or **Record<string, any>** or **any[]** <br/> _Required_: true |                                                                                                                                                                                         Message to send |
| eventType    |                    _Type_: **string** <br/> _Required_: false                     |                                                                    Event type param in SSE message, check: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events |
| groupName    |                    _Type_: **string** <br/> _Required_: false                     |                                                                                                      The group(namespace) where to get this client by id from, if not provided it goes to default group |
| sseMsgId     |                    _Type_: **number** <br/> _Required_: false                     |                                   The event ID to set the EventSource object's last event ID value, check: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events |


### getClientObj(clientId [, groupName ])

Get user's active connections and his meta

Params:

| Param     |                Type/Required                 |                                                                                                                                                               Comment |
|:----------|:--------------------------------------------:|----------------------------------------------------------------------------------------------------------------------------------------------------------------------:|
| clientId  |  _Type_: **string** <br/> _Required_: true   |                                                                                                                                                       Message to send |
| groupName |  _Type_: **string** <br/> _Required_: false  |                                                                    The group(namespace) where to get this client by id from, if not provided it goes to default group |

Method returns:

```
 {
    connections: HttpResponse[]; // array of raw NodeJS responses,
    // will contain more then one if we add few connections by the same clientId param
    meta?: Record<string, any>; // any meta you have added by meta param
    clientId: string; // client id you passed to or the one generated by lib
 };
```

### getAllClientObjs([groupName])

Get connections and meta of all active clients

Params:

| Param     |                Type/Required                 |                                                                                             Comment |
|:----------|:--------------------------------------------:|----------------------------------------------------------------------------------------------------:|
| groupName |  _Type_: **string** <br/> _Required_: false  |       The group(namespace) where to get this clients from, if not provided it goes to default group |

Method returns:

```
 Array<{
    connections: HttpResponse[]; // array of raw NodeJS responses,
    // will contain more then one if we add few connections by the same clientId param
    meta?: Record<string, any>; // any meta you have added by meta param
    clientId: string; // client id you passed to or the one generated by lib
 }>;
```

### setClientMetadata(clientId [, groupName ])

Set client's meta 

Params:

| Param     |                     Type/Required                      |                                                                                            Comment |
|:----------|:------------------------------------------------------:|---------------------------------------------------------------------------------------------------:|
| clientId  |       _Type_: **string** <br/> _Required_: true        |                                                                                       Id of client |
| meta      | _Type_: **Record<string, any>** <br/> _Required_: true |                                                      Some meta you need to persist for this client |
| groupName |       _Type_: **string** <br/> _Required_: false       | The group(namespace) where to get this client by id from, if not provided it goes to default group |

Method returns:

```
 {
    connections: HttpResponse[]; // array of raw NodeJS responses,
    // will contain more then one if we add few connections by the same clientId param
    meta?: Record<string, any>; // any meta you have added by meta param
    clientId: string; // client id you passed to or the one generated by lib
 };k
```

## License

[MIT](LICENSE)

