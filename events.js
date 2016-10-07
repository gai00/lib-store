/*
author: Layer <gai00layer@gmail.com>
version: 1.0.2
change logs:
  1.0.2
    將del改為off，預防被誤會為資料刪除指令
  1.0.1
    增加版本號
  1.0.0
    完成
*/

/*
設計概念:
可以被各種物件套用，可以在任何地方取得之前產生過的事件器。
有優先權排序(priority)，會依序執行。
*/
export class Events {
  // 版本號
  VERSION = '1.0.1';
  
  // static properties
  static eventNamespaces = {};
  static methods = ['on', 'once', 'off', 'emit'];
  
  //static methods
  static getEvents(namespace) {
    namespace = namespace || 'events';
    if(!this.eventNamespaces[namespace]) {
      this.eventNamespaces[namespace] = new this(namespace);
    }
    return this.eventNamespaces[namespace];
  }
  
  // properties
  eventsName = '';
  ids = [];
  events = {
    /*
    eventName: [
      wrap,
      ...
    ]
    */
  };
  
  // methods
  // 建構子
  constructor(eventsName) {
    this.eventsName = eventsName;
  }
  
  // auto increment
  _autoinc = 1;
  autoinc() {
    return this._autoinc++;
  }
  
  wrap(eventName, eventCallback, priority, isOnce) {
    isOnce = isOnce || false;
    return {
      id: this.autoinc(),
      eventName: eventName,
      eventCallback: eventCallback,
      priority: priority,
      isOnce: isOnce
    };
  }
  
  // 增加事件
  on(eventName, eventCallback, priority, isOnce) {
    priority = priority || 0;
    
    var wrap = this.wrap(eventName, eventCallback, priority, isOnce);
    this.ids.push(wrap);
    this.events[eventName] = this.events[eventName] || [];
    
    let eventList = this.events[eventName];
    if(eventList.length === 0) {
      eventList.push(wrap);
    }
    else {
      for(let i = 0; i < eventList.length; i += 1) {
        if(eventList[i].priority < priority) {
          eventList.splice(i, 0, wrap);
          break;
        }
        // 最後一筆的話
        else if(i === eventList.length - 1) {
          eventList.push(wrap);
          break;
        }
      }// end of for
    }
    
    return wrap.id;
  }
  
  // 只有執行一次的增加事件
  once(eventName, eventCallback, priority) {
    return this.on(eventName, eventCallback, priority, true);
  }
  
  // 移除事件
  // 原本的del
  off(id) {
    var found = false;
    // 找到ids裡面的指定id的wrap
    
    for(let i in this.ids) {
      let wrap = this.ids[i];
      if(wrap.id == id) {
        found = true;
        
        // 找到之後，移除指定事件清單裡面的該項目
        let eventIndex = this.events[wrap.eventName].indexOf(wrap)
        if(~eventIndex) {
          this.events[wrap.eventName].splice(eventIndex, 1);
        }
        
        break;
      }
    }
    
    return found;
  }
  
  // 觸發事件
  emit(eventName, args) {
    var eventList = this.events[eventName] = this.events[eventName] || [];
    var shouldBeDel = [];
    for(let wrap of eventList) {
      wrap.eventCallback.apply(null, args);
      
      // 將只執行一次的event放到將會移除的陣列
      if(wrap.isOnce) {
        shouldBeDel.push(wrap.id);
      }
    }
    
    // 移除需要被移除的event
    for(let eventId of shouldBeDel) {
      this.del(eventId);
    }
  }
  
  // 實作到某物件
  bind(target) {
    // 沒辦法綁定就丟錯誤
    if(Object.prototype.toString.call(target) != '[object Object]') {
      throw new Error('Events only can bind on object.');
    }
    
    for(let propertyName of Events.methods) {
      target[propertyName] = this[propertyName].bind(this);
    }
  }
}

var events = new Events();
export default events;