# Light-writer demo

A small p2p chat app built around an autobee synced through hyperswarm.
A "price service" outputting a random-walk price through a light-writer is used as an input to the chatroom autobee.

This project is meant to facilitate the discovery of light-writer patterns.

## How it works

**Chat.** Each client has its own Corestore and joins a Hyperswarm discovery topic (`chat`). When two peers connect they
run a one-shot handshake to agree on a single room: if one already has a room it hands out its key, otherwise the
DHT-key-smallest peer bootstraps it. The room is an **Autobee**. Chat lines are `room.append`ed and replicated to every peer.

**The service / light-writer.** The price service (`pnpm run service`) is a separate process. It owns its own Corestore
and a **light writer**, doesn't act as a peer to the chat room, and doesn't know about any room. It broadcasts a
random-walk price every 3 seconds, and lets clients find it on a topic and ask it for its light-writer key.

A peer subscribes with `!service` in chat. That is itself an **append**: the inviting peer asks the service for its
light-writer key over a short RPC, then appends that key to the room as an _invitation_. The room's `apply()` hands
every batch to the room's own `process()` (`price-feed.ts`), which records the key in the view and takes the service's
light-writer nodes in as `price bot: <price>` lines. Every peer then discovers the service on its own topic and
`wakeup`s once on its light-writer core.

**The weather service / a call.** `npm run weather` is a second service, and a different shape: a _call_ rather than a
feed. A peer asks with `!weather wind 52.37 4.9`. The request is appended to a light writer in **the peer's own store**,
never to the room. The weather service is an Autobee whose inputs are those callers' light writers: its `apply()` records
what was asked, and it answers outside `apply()` on a light writer of its own. The room follows that writer (it was
invited with `!weather`, like the price service), and the answer becomes a line for everyone. Each request says where its
answer goes (an address derived from the room's key), so one service can answer many rooms, each in its own.

## Running

```bash
npm install
npm run bootstrap            # local HyperDHT bootstrap on 127.0.0.1:30001
npm run client alice         # in another terminal
npm run client bob           # in another terminal
npm run service              # the price service in another terminal
npm run weather              # the weather service in another terminal
```

Two clients discover each other, form the room, and exchange messages. In any client, type `!service` to invite the
price service; both clients then print `price bot: <price>` lines as they arrive.

Type `!weather` to invite the weather service, then ask it from either client with
`!weather <time|temperature|uv|wind|cloud> <lat> <lon>`, e.g. `!weather wind 52.37 4.9`. Both clients print
`weather bot: wind 7.1 km/h at 52.37,4.9`. (The weather is made up: random numbers.)

## Notes

I decided to build this as a TypeScript project to be able to navigate the APIs more easily.
An agent wrote the missing ambient types based on the sourcecode of dependencies.
