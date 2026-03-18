import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Send, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function MessagesPage() {
  const { user } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [messageContent, setMessageContent] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: unreadCount } = trpc.messaging.getUnreadCount.useQuery();
  const { data: messages = [], isLoading: messagesLoading } = trpc.messaging.getConversation.useQuery(
    selectedUserId ? { otherUserId: selectedUserId } : { otherUserId: 0 },
    { enabled: !!selectedUserId }
  );

  const sendMessageMutation = trpc.messaging.sendMessage.useMutation({
    onSuccess: () => {
      setMessageContent("");
    },
  });

  const handleSendMessage = async () => {
    if (!selectedUserId || !messageContent.trim()) return;

    setLoading(true);
    try {
      await sendMessageMutation.mutateAsync({
        recipientId: selectedUserId,
        content: messageContent,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Please sign in to view messages</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-white p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Messages</h1>
          <p className="text-gray-600">
            Connect with your matches and start conversations
          </p>
          {unreadCount && unreadCount.unreadCount > 0 && (
            <div className="mt-4 p-3 bg-pink-100 border border-pink-300 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-pink-600" />
              <span className="text-pink-900">
                You have {unreadCount.unreadCount} unread message{unreadCount.unreadCount !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Conversations List */}
          <div className="md:col-span-1">
            <Card className="p-4">
              <h2 className="font-semibold text-lg mb-4">Conversations</h2>
              <div className="space-y-2">
                <p className="text-gray-500 text-sm">
                  Select a conversation to start messaging
                </p>
              </div>
            </Card>
          </div>

          {/* Chat Area */}
          <div className="md:col-span-2">
            {selectedUserId ? (
              <Card className="p-6 flex flex-col h-[600px]">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
                    </div>
                  ) : messages.length > 0 ? (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${
                          msg.senderId === user.id ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-xs px-4 py-2 rounded-lg ${
                            msg.senderId === user.id
                              ? "bg-pink-500 text-white"
                              : "bg-gray-200 text-gray-900"
                          }`}
                        >
                          <p className="text-sm">{msg.content}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {new Date(msg.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <p>No messages yet. Start the conversation!</p>
                    </div>
                  )}
                </div>

                {/* Input Area */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Type your message..."
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={loading}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={loading || !messageContent.trim()}
                    className="bg-pink-500 hover:bg-pink-600"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </Card>
            ) : (
              <Card className="p-12 text-center">
                <p className="text-gray-500 text-lg">
                  Select a conversation to start messaging
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
