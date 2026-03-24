from channels.generic.websocket import AsyncJsonWebsocketConsumer

class MediaTreeConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        await self.channel_layer.group_add("media-tree", self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        await self.channel_layer.group_discard("media-tree", self.channel_name)

    async def media_update(self, event):
        await self.send_json(event["data"])