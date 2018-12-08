declare type Message = {
  userId: ?number,
  username: string,
  text: string,
  timestamp: number
}

declare type Table = {
  id: number,
  userIds: Array<number>,
  painterId: ?number,
  messages: Array<Message>,
  word: ?string
}

declare type User = {
  id: number,
  socketId: string,
  username: string
}

declare type UserMessageFromSocket = {
  text: string,
  userId: number,
  tableId: number
}

declare type DrawImageData = {
  tableId: number,
  userId: number,
  x: number,
  y: number,
  type: DrawType,
  size: number,
  color: string
}