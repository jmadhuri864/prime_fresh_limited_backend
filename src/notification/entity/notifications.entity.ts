import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne } from "typeorm";
import Model from "../global/model.entity";
import { User } from "./user.entity";

@Entity('notifications')
export class Notification extends Model {

    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: 'user_id' })
    user: User;
    @Column({ default: false })
    isRead: boolean;

    @Column()
    message: string;


    @CreateDateColumn()
    createdAt: Date;

}
