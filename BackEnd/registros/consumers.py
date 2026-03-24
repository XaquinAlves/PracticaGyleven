import logging

from channels.generic.websocket import AsyncJsonWebsocketConsumer

logger = logging.getLogger(__name__)

class MediaTreeConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        logger.info(
            "%s connecting via layer %s (id %s)",
            self.channel_name,
            self.channel_layer.__class__.__name__,
            id(self.channel_layer),
        )
        await self.channel_layer.group_add("media-tree", self.channel_name)
        await self.accept()
        await self.send_json({"action": "ready"})
        logger.info("%s ready sent", self.channel_name)

    async def disconnect(self, code):
        logger.info("%s disconnecting", self.channel_name)
        await self.channel_layer.group_discard("media-tree", self.channel_name)

    async def media_update(self, event):
        logger.info("%s sending event %s", self.channel_name, event)
        await self.send_json(event["data"])
