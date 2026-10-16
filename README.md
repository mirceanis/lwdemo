# Light-writer demo

A small p2p chat app built around an autobee synced through hyperswarm.
A "price service" outputting a random-walk price through a light-writer is used as an input to the chatroom autobee.

This project is meant to facilitate the discovery of light-writer patterns.

## How it works

**Chat.** Each client has its own Corestore and joins a Hyperswarm discovery topic (`chat`). When two peers connect they
run a one-shot handshake to agree on a single room: if one already has a room it hands out its key, otherwise the
DHT-key-smallest peer bootstraps it. The room is an **Autobee**. Chat lines are `room.append`ed and replicated to every peer.

**The service / light-writer.** The price service (`pnpm run service`) is a separate process. It owns its own Corestore
and a **light writer**, doesn't act as a peer to the chat room. It broadcasts a random-walk price every 3 seconds.

A peer subscribes with `!service` in chat. That is itself an **append**: the inviting peer asks the service for its
light-writer key over a short RPC, then appends that key to the room as an _invitation_. `apply()` records the key in
the view; every peer then discovers the service on its own topic and `wakeup`s on its light-writer core, so its price
blocks are ingested and folded into the room as `price bot: <price>` lines.

## Running

```bash
npm install
npm run bootstrap            # local HyperDHT bootstrap on 127.0.0.1:30001
npm run client alice         # in another terminal
npm run client bob           # in another terminal
npm run service              # the price service in another terminal
```

Two clients discover each other, form the room, and exchange messages. In any client, type `!service` to invite the
price service; both clients then print `price bot: <price>` lines as they arrive.

## Notes

I decided to build this as a TypeScript project to be able to navigate the APIs more easily.
An agent wrote the missing ambient types based on the sourcecode of dependencies.
