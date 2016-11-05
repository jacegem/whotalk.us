import React, {Component} from 'react';
import { Chat } from 'components';

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {Scrollbars} from 'react-custom-scrollbars';

import * as ui from 'actions/ui';
import * as form from 'actions/form';
import * as channel from 'actions/channel';

import sender from 'socket/packetSender';

import * as socket from 'socket';
import * as socketHelper from 'socket/helper';
import {client as SEND} from 'socket/packetTypes';

import autobind from 'autobind-decorator';

class ChatRoute extends Component {

    constructor(props) {
        super(props);
        this.state = {
            clientHeight: 0
        };
    }

    componentWillMount() {
        this.updateClientHeight();
    }

    componentDidMount() {
        const {params, UIActions, ChannelActions} = this.props;
        UIActions.initialize('channel');
        ChannelActions.initialize(params.username);
        UIActions.setHeaderTransparency(false);
        UIActions.setFooterVisibility(false);

        // disable overflow for 0.7 seconds
        document.body.style.overflow = "hidden";
        setTimeout(() => {
            document.body.style.overflow = ""
        }, 700);

        window.addEventListener("resize", this.updateClientHeight);
        socket.init();
    }

    @autobind
    scrollToBottom() {
        // SCROLL TO BOTTOM
        this
            .scrollBox
            .scrollTop(this.scrollBox.getScrollHeight());
    }

    @autobind
    updateClientHeight() {
        this.setState({clientHeight: document.body.clientHeight});

    }

    @autobind
    handleOpenSelect() {
        const {UIActions} = this.props;
        UIActions.setChannelChatState({selecting: true});
    }

    @autobind
    handleSelect(identity) {
        const {status, ChannelActions, UIActions} = this.props;
        ChannelActions.setIdentity(identity);
        UIActions.setChannelChatState({started: true});

        sender.auth(status.session.sessionID, identity === 'anonymous');
        this.handleCloseSelect();
    }

    @autobind
    handleCloseSelect() {
        const {UIActions} = this.props;
        UIActions.setChannelChatState({closing: true});
        setTimeout(() => {
            UIActions.setChannelChatState({closing: false, selecting: false})
        }, 700);
    }

    @autobind
    handleSend(message) {
        const {status, ChannelActions, FormActions} = this.props;
        const uID = socketHelper.generateUID();
        const data = {
            message,
            uID
        };
        sender.message(data);
        ChannelActions.writeMessage({
            type: SEND.MSG,
            payload: {
                anonymous: status.identity === 'anonymous',
                date: (new Date()).getTime(),
                message,
                uID,
                suID: uID,
                username: status.socket.username
            }
        });
    }

    @autobind
    handleFailure(index) {
        const {ChannelActions} = this.props;
        ChannelActions.messageFailure(index);
    }

    @autobind
    handleRemove(index) {
        const {ChannelActions} = this.props;
        ChannelActions.removeMessage(index);
    }

    shouldComponentUpdate(nextProps, nextState) {

        if (JSON.stringify(nextState.clientHeight) !== JSON.stringify(this.state.clientHeight)) {
            return true;
        }

        const checkDiff = () => {
            if (nextProps.status.chatData.length > 0) {
                if (nextProps.status.chatData.length !== this.props.status.chatData.length) {
                    return true;
                }

                // check tempIndexes
                for (let index of this.props.status.tempDataIndex) {
                    if (nextProps.status.chatData[index].payload.suID !== this.props.status.chatData[index].payload.suID) {
                        return true;
                    }
                }
                return false;
            } else {
                return false;
            }
        }

        const compareObject = JSON.stringify({
            ...this.props.status,
            chatData: null
        }) !== JSON.stringify({
            ...nextProps.status,
            chatData: null
        });

        // if compareObject is false, it will do checkDiff
        return compareObject || checkDiff();

    }

    componentDidUpdate(prevProps, prevState) {
        if (prevProps.status.chatData.length !== this.props.status.chatData.length || prevState.clientHeight !== this.state.clientHeight) {
            this.scrollToBottom();
        }

    }

    render() {

        const {status} = this.props;

        const {
            handleOpenSelect,
            handleSelect,
            handleCloseSelect,
            handleSend,
            handleFailure,
            handleRemove
        } = this;

        const showStartButton = !status.chatState.started;
        const showSelect = status.chatState.selecting;
        const selectClosing = status.chatState.closing;

        return (
            <Chat.Screen>
                <Scrollbars
                    style={{
                    width: '100%',
                    height: this.state.clientHeight - 120 + 'px',
                    borderBottom: '1px solid rgba(0,0,0,0.10)'
                }}
                    className="scrollbox"
                    ref={(ref) => {
                    this.scrollBox = ref
                }}>
                    <Chat.MessageList
                        data={status.chatData}
                        onFailure={handleFailure}
                        onRemove={handleRemove}
                        onSend={handleSend}/>
                </Scrollbars>
                {showStartButton
                    ? <Chat.Start onClick={handleOpenSelect} disabled={(!status.socket.enter)}/>
                    : <Chat.Input onSend={handleSend} controlled={status.socket.controlled}/>}
                {showSelect
                    ? <Chat.Select
                            username={status.session.user.common_profile.username}
                            onClose={handleCloseSelect}
                            onSelect={handleSelect}
                            closing={selectClosing}/>
                    : undefined}
            </Chat.Screen>
        );
    }

    componentWillUnmount() {
        console.log(socket);
        if (socket.getSocket()) {
            socket.close();
        }

        window.removeEventListener("resize", this.updateClientHeight);
    }

}

ChatRoute = connect(state => ({
    status: {
        chatState: state.ui.channel.chat,
        session: state.auth.session,
        socket: state.channel.chat.socket,
        identity: state.channel.chat.identity,
        chatData: state.channel.chat.data,
        tempDataIndex: state.channel.chat.tempDataIndex
    }
}), dispatch => ({
    ChannelActions: bindActionCreators(channel, dispatch),
    FormActions: bindActionCreators(form, dispatch),
    UIActions: bindActionCreators({
        initialize: ui.initialize,
        setHeaderTransparency: ui.setHeaderTransparency,
        setFooterVisibility: ui.setFooterVisibility,
        setChannelChatState: ui.setChannelChatState
    }, dispatch)
}))(ChatRoute);

export default ChatRoute;