import type { UserId } from '../kernel/ids';
import type { EngagementEvent, EngagementTelemetryPreference } from './types';

export class EngagementStore{
  private static instance:EngagementStore;
  static getInstance(){if(!this.instance)this.instance=new EngagementStore();return this.instance;}

  private events=new Map<string,EngagementEvent>();
  private eventByIdempotency=new Map<string,string>();
  private preferences=new Map<string,EngagementTelemetryPreference>();

  reset():void{this.events.clear();this.eventByIdempotency.clear();this.preferences.clear();}

  savePreference(v:EngagementTelemetryPreference):void{this.preferences.set(String(v.userId),{...v});}
  getPreference(userId:UserId):EngagementTelemetryPreference|undefined{
    const v=this.preferences.get(String(userId));return v?{...v}:undefined;
  }
  listPreferences():EngagementTelemetryPreference[]{return Array.from(this.preferences.values()).map(v=>({...v}));}

  saveEvent(v:EngagementEvent):EngagementEvent{
    const priorId=this.eventByIdempotency.get(v.idempotencyKey);
    if(priorId){const prior=this.events.get(priorId)!;return {...prior};}
    this.events.set(v.eventId,{...v});
    this.eventByIdempotency.set(v.idempotencyKey,v.eventId);
    return {...v};
  }
  getEventByIdempotency(key:string):EngagementEvent|undefined{
    const id=this.eventByIdempotency.get(key);const v=id?this.events.get(id):undefined;return v?{...v}:undefined;
  }
  listEvents():EngagementEvent[]{return Array.from(this.events.values()).map(v=>({...v})).sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt));}
}
