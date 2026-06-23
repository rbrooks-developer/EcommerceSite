import EasyPost from "@easypost/api";

let _client: InstanceType<typeof EasyPost> | null = null;

export function getEasyPostClient() {
  if (!_client) {
    _client = new EasyPost(process.env.EASYPOST_API_KEY!);
  }
  return _client;
}
